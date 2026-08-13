import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  adminTurnstileConfigurationSchema,
  updateAdminTurnstileConfigurationSchema,
  type AdminTurnstileConfiguration,
  type PlatformAdminAuthSession,
  type PublicTurnstileConfiguration,
} from '@workspace/contracts';
import { apiAuditLogs, providerIntegrations } from '@workspace/database';
import { eq } from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { AppException } from '../platform/errors/app-exception';

const providerKey = 'cloudflare-turnstile';
const turnstileSiteverifyUrl =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type TurnstileConfiguration = {
  siteKey: string;
  secretKey: string;
};

type TurnstileResponse = {
  success?: unknown;
  'error-codes'?: unknown;
};

@Injectable()
export class CaptchaService {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  async getPublicConfiguration(): Promise<PublicTurnstileConfiguration> {
    const row = await this.row();
    const configuration = this.decryptConfiguration(
      row?.configurationCiphertext,
    );
    if (!row?.enabled || !this.isComplete(configuration)) {
      return { enabled: false, siteKey: null };
    }

    return { enabled: true, siteKey: configuration.siteKey };
  }

  async getAdminConfiguration(): Promise<AdminTurnstileConfiguration> {
    const row = await this.row();
    const configuration = this.decryptConfiguration(
      row?.configurationCiphertext,
    );
    const configured = this.isComplete(configuration);
    const enabled = row?.enabled ?? false;

    return adminTurnstileConfigurationSchema.parse({
      enabled,
      readiness: enabled ? (configured ? 'ready' : 'incomplete') : 'disabled',
      siteKey: configuration?.siteKey ?? null,
      secretConfigured: Boolean(configuration?.secretKey),
    });
  }

  async saveAdminConfiguration(
    input: unknown,
    session: PlatformAdminAuthSession,
  ): Promise<AdminTurnstileConfiguration> {
    const parsed = updateAdminTurnstileConfigurationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const row = await this.row();
    const stored = this.decryptConfiguration(row?.configurationCiphertext);
    const configuration = this.mergeConfiguration(parsed.data, stored);
    const configured = this.isComplete(configuration);
    if (parsed.data.enabled && !configured) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const now = new Date();
    const readiness = parsed.data.enabled ? 'ready' : 'disabled';
    const enabledCapabilityKeys = parsed.data.enabled
      ? ['auth_login', 'auth_register']
      : [];
    const configurationCiphertext = configured
      ? this.encryption().encrypt(JSON.stringify(configuration), providerKey)
      : null;

    await this.database.db.transaction(async (tx) => {
      await tx
        .insert(providerIntegrations)
        .values({
          providerKey,
          enabled: parsed.data.enabled,
          readiness,
          capabilities: ['auth_login', 'auth_register'],
          enabledCapabilityKeys,
          configurationCiphertext,
          readinessIssues: parsed.data.enabled ? [] : ['provider_disabled'],
          updatedByUserId: session.user.id,
        })
        .onConflictDoUpdate({
          target: providerIntegrations.providerKey,
          set: {
            enabled: parsed.data.enabled,
            readiness,
            capabilities: ['auth_login', 'auth_register'],
            enabledCapabilityKeys,
            configurationCiphertext,
            readinessIssues: parsed.data.enabled ? [] : ['provider_disabled'],
            updatedByUserId: session.user.id,
            updatedAt: now,
          },
        });

      await tx.insert(apiAuditLogs).values({
        actorUserId: session.user.id,
        event: 'security.turnstile_updated',
        subjectType: 'provider_integration',
        severity: 'success',
        summary: parsed.data.enabled
          ? 'Cloudflare Turnstile enabled for authentication.'
          : 'Cloudflare Turnstile disabled for authentication.',
        metadata: {
          enabled: parsed.data.enabled,
          configured,
          scopes: ['login', 'register'],
        },
      });
    });

    return this.getAdminConfiguration();
  }

  async verifyAuthenticationToken(
    token: string | undefined,
    remoteIp: string | undefined,
  ): Promise<void> {
    const row = await this.row();
    if (!row?.enabled) return;

    const configuration = this.decryptConfiguration(
      row.configurationCiphertext,
    );
    if (!this.isComplete(configuration)) {
      throw new AppException(
        'AUTH_CAPTCHA_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!token?.trim()) {
      throw new AppException('AUTH_CAPTCHA_INVALID', HttpStatus.BAD_REQUEST);
    }

    let response: Response;
    let body: TurnstileResponse | null = null;
    try {
      response = await fetch(turnstileSiteverifyUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: configuration.secretKey,
          response: token.trim(),
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
        signal: AbortSignal.timeout(5_000),
      });
      body = (await response
        .json()
        .catch(() => null)) as TurnstileResponse | null;
    } catch {
      throw new AppException(
        'AUTH_CAPTCHA_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!response.ok || this.hasInvalidSecret(body)) {
      throw new AppException(
        'AUTH_CAPTCHA_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (body?.success !== true) {
      throw new AppException('AUTH_CAPTCHA_INVALID', HttpStatus.BAD_REQUEST);
    }
  }

  private async row() {
    const [row] = await this.database.db
      .select({
        enabled: providerIntegrations.enabled,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
      })
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, providerKey))
      .limit(1);
    return row;
  }

  private mergeConfiguration(
    input: {
      siteKey: string;
      secretKey?: string;
    },
    stored: TurnstileConfiguration | null,
  ): TurnstileConfiguration | null {
    const siteKey = input.siteKey || stored?.siteKey || '';
    const secretKey = input.secretKey ?? stored?.secretKey ?? '';
    if (!siteKey && !secretKey) return null;
    return { siteKey, secretKey };
  }

  private decryptConfiguration(
    ciphertext: string | null | undefined,
  ): TurnstileConfiguration | null {
    if (!ciphertext) return null;
    try {
      const value: unknown = JSON.parse(
        this.encryption().decrypt(ciphertext, providerKey),
      );
      if (
        !value ||
        typeof value !== 'object' ||
        !('siteKey' in value) ||
        !('secretKey' in value) ||
        typeof value.siteKey !== 'string' ||
        typeof value.secretKey !== 'string'
      ) {
        return null;
      }
      return { siteKey: value.siteKey, secretKey: value.secretKey };
    } catch {
      return null;
    }
  }

  private isComplete(
    configuration: TurnstileConfiguration | null,
  ): configuration is TurnstileConfiguration {
    return Boolean(
      configuration?.siteKey.trim() && configuration.secretKey.trim(),
    );
  }

  private hasInvalidSecret(body: TurnstileResponse | null) {
    return (
      Array.isArray(body?.['error-codes']) &&
      body['error-codes'].some((code) => code === 'invalid-input-secret')
    );
  }

  private encryption() {
    return new Aes256GcmService(
      this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'),
    );
  }
}
