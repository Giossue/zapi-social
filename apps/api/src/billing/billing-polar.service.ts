import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Polar } from '@polar-sh/sdk';
import {
  updatePolarIntegrationSchema,
  type AuthSession,
  type PolarIntegration,
  type UpdatePolarIntegrationInput,
} from '@workspace/contracts';
import { providerIntegrations } from '@workspace/database';
import { eq } from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';

const providerKey = 'polar';

export type PolarConfiguration = {
  environment: 'sandbox' | 'live';
  recurring: boolean;
  monthlyProductId: string;
  yearlyProductId: string;
  oneTimeProductId: string;
  discountCodes: boolean;
  billingAddress: boolean;
  accessToken: string;
  webhookSecret: string;
};

@Injectable()
export class BillingPolarService {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  async get(): Promise<PolarIntegration> {
    const row = await this.row();
    const configuration = this.decrypt(row?.configurationCiphertext);
    const apiOrigin = this.config.getOrThrow<string>('API_PUBLIC_ORIGIN');
    const webOrigin = this.config.getOrThrow<string>('WEB_ORIGIN');
    return {
      enabled: row?.enabled ?? false,
      configured: Boolean(
        configuration?.accessToken && configuration.webhookSecret,
      ),
      environment: configuration?.environment ?? 'sandbox',
      recurring: configuration?.recurring ?? true,
      monthlyProductId: configuration?.monthlyProductId ?? '',
      yearlyProductId: configuration?.yearlyProductId ?? '',
      oneTimeProductId: configuration?.oneTimeProductId ?? '',
      discountCodes: configuration?.discountCodes ?? true,
      billingAddress: configuration?.billingAddress ?? false,
      hasAccessToken: Boolean(configuration?.accessToken),
      hasWebhookSecret: Boolean(configuration?.webhookSecret),
      webhookUrl: new URL('/v1/webhooks/polar', apiOrigin).toString(),
      successUrl: new URL('/portal/billing/success', webOrigin).toString(),
      cancelUrl: new URL('/portal/billing/cancel', webOrigin).toString(),
    };
  }

  async save(input: unknown, session: AuthSession): Promise<PolarIntegration> {
    const parsed = updatePolarIntegrationSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException();
    const row = await this.row();
    const previous = this.decrypt(row?.configurationCiphertext);
    const configuration = this.merge(parsed.data, previous);
    if (
      parsed.data.enabled &&
      (!configuration.accessToken || !configuration.webhookSecret)
    ) {
      throw new BadRequestException('Polar credentials are required');
    }

    const now = new Date();
    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey,
        enabled: parsed.data.enabled,
        readiness: parsed.data.enabled ? 'ready' : 'disabled',
        capabilities: ['checkout', 'subscriptions', 'refunds', 'discounts'],
        enabledCapabilityKeys: parsed.data.recurring
          ? ['checkout', 'subscriptions', 'refunds', 'discounts']
          : ['checkout', 'refunds', 'discounts'],
        configurationCiphertext: this.encryption().encrypt(
          JSON.stringify(configuration),
          providerKey,
        ),
        readinessIssues: [],
        updatedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          enabled: parsed.data.enabled,
          readiness: parsed.data.enabled ? 'ready' : 'disabled',
          enabledCapabilityKeys: parsed.data.recurring
            ? ['checkout', 'subscriptions', 'refunds', 'discounts']
            : ['checkout', 'refunds', 'discounts'],
          configurationCiphertext: this.encryption().encrypt(
            JSON.stringify(configuration),
            providerKey,
          ),
          readinessIssues: [],
          updatedByUserId: session.user.id,
          updatedAt: now,
        },
      });
    return this.get();
  }

  async configuration(): Promise<PolarConfiguration> {
    const row = await this.row();
    const configuration = this.decrypt(row?.configurationCiphertext);
    if (
      !row?.enabled ||
      !configuration?.accessToken ||
      !configuration.webhookSecret
    ) {
      throw new ServiceUnavailableException('Polar is not configured');
    }
    return configuration;
  }

  async client(): Promise<Polar> {
    const configuration = await this.configuration();
    return new Polar({
      accessToken: configuration.accessToken,
      server:
        configuration.environment === 'sandbox' ? 'sandbox' : 'production',
      timeoutMs: 15_000,
      retryConfig: {
        strategy: 'backoff',
        backoff: {
          initialInterval: 500,
          maxInterval: 2_000,
          exponent: 1.5,
          maxElapsedTime: 5_000,
        },
        retryConnectionErrors: true,
      },
    });
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

  private merge(
    input: UpdatePolarIntegrationInput,
    previous?: PolarConfiguration,
  ): PolarConfiguration {
    return {
      environment: input.environment,
      recurring: input.recurring,
      monthlyProductId: input.monthlyProductId,
      yearlyProductId: input.yearlyProductId,
      oneTimeProductId: input.oneTimeProductId,
      discountCodes: input.discountCodes,
      billingAddress: input.billingAddress,
      accessToken: input.accessToken || previous?.accessToken || '',
      webhookSecret: input.webhookSecret || previous?.webhookSecret || '',
    };
  }

  private decrypt(ciphertext?: string | null): PolarConfiguration | undefined {
    if (!ciphertext) return undefined;
    try {
      return JSON.parse(
        this.encryption().decrypt(ciphertext, providerKey),
      ) as PolarConfiguration;
    } catch {
      return undefined;
    }
  }

  private encryption() {
    return new Aes256GcmService(
      this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'),
    );
  }
}
