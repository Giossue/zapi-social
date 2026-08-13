import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Polar } from '@polar-sh/sdk';
import {
  updatePolarIntegrationSchema,
  testPolarIntegrationSchema,
  type AuthSession,
  type PolarConfigurationDraft,
  type PolarIntegration,
  type TestPolarIntegrationResponse,
} from '@workspace/contracts';
import { providerIntegrations } from '@workspace/database';
import { eq } from '@workspace/database/query';
import { createHash } from 'node:crypto';
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
    const configured = this.isComplete(configuration);
    const tested = Boolean(
      configuration &&
      row?.testedConfigFingerprint === this.fingerprint(configuration),
    );
    const readiness = !row?.enabled
      ? 'disabled'
      : !configured
        ? 'incomplete'
        : tested
          ? 'ready'
          : 'untested';
    const apiOrigin = this.config.getOrThrow<string>('API_PUBLIC_ORIGIN');
    const webOrigin = this.config.getOrThrow<string>('WEB_ORIGIN');
    return {
      enabled: row?.enabled ?? false,
      configured,
      readiness,
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
      lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
    };
  }

  async test(
    input: unknown,
    session: AuthSession,
  ): Promise<TestPolarIntegrationResponse> {
    const parsed = testPolarIntegrationSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException();

    const row = await this.row();
    const storedConfiguration = this.decrypt(row?.configurationCiphertext);
    const configuration = this.merge(
      parsed.data.configuration,
      storedConfiguration,
    );
    this.assertComplete(configuration);
    await this.verify(configuration);

    const testedAt = new Date();
    const testsStoredConfiguration = Boolean(
      storedConfiguration &&
      this.fingerprint(storedConfiguration) === this.fingerprint(configuration),
    );
    const readiness = !row?.enabled
      ? 'disabled'
      : testsStoredConfiguration
        ? 'ready'
        : 'untested';
    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey,
        enabled: row?.enabled ?? false,
        readiness,
        capabilities: ['checkout', 'subscriptions', 'refunds', 'discounts'],
        enabledCapabilityKeys: row?.enabledCapabilityKeys ?? [],
        configurationCiphertext: row?.configurationCiphertext ?? null,
        readinessIssues: [],
        testedConfigFingerprint: this.fingerprint(configuration),
        lastTestedAt: testedAt,
        lastTestedByPlatformAdminId: session.user.id,
        updatedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          readiness,
          readinessIssues: [],
          testedConfigFingerprint: this.fingerprint(configuration),
          lastTestedAt: testedAt,
          lastTestedByPlatformAdminId: session.user.id,
          updatedAt: testedAt,
        },
      });

    return { testedAt: testedAt.toISOString() };
  }

  async save(input: unknown, session: AuthSession): Promise<PolarIntegration> {
    const parsed = updatePolarIntegrationSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException();
    const row = await this.row();
    const previous = this.decrypt(row?.configurationCiphertext);
    const { enabled, ...draft } = parsed.data;
    const configuration = this.merge(draft, previous);
    if (enabled) {
      this.assertComplete(configuration);
      if (row?.testedConfigFingerprint !== this.fingerprint(configuration)) {
        throw new BadRequestException(
          'Polar configuration must be tested before saving',
        );
      }
    }

    const now = new Date();
    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey,
        enabled,
        readiness: enabled ? 'ready' : 'disabled',
        capabilities: ['checkout', 'subscriptions', 'refunds', 'discounts'],
        enabledCapabilityKeys: draft.recurring
          ? ['checkout', 'subscriptions', 'refunds', 'discounts']
          : ['checkout', 'refunds', 'discounts'],
        configurationCiphertext: this.encryption().encrypt(
          JSON.stringify(configuration),
          providerKey,
        ),
        readinessIssues: [],
        testedConfigFingerprint: row?.testedConfigFingerprint ?? null,
        lastTestedAt: row?.lastTestedAt ?? null,
        updatedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          enabled,
          readiness: enabled ? 'ready' : 'disabled',
          enabledCapabilityKeys: draft.recurring
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
      !configuration ||
      !this.isComplete(configuration) ||
      row.testedConfigFingerprint !== this.fingerprint(configuration)
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
        enabledCapabilityKeys: providerIntegrations.enabledCapabilityKeys,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
        testedConfigFingerprint: providerIntegrations.testedConfigFingerprint,
        lastTestedAt: providerIntegrations.lastTestedAt,
      })
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, providerKey))
      .limit(1);
    return row;
  }

  private merge(
    input: PolarConfigurationDraft,
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

  private isComplete(configuration?: PolarConfiguration): boolean {
    return Boolean(
      configuration?.accessToken &&
      configuration.webhookSecret &&
      (!configuration.recurring ||
        (configuration.monthlyProductId && configuration.yearlyProductId)),
    );
  }

  private assertComplete(configuration: PolarConfiguration): void {
    if (!this.isComplete(configuration)) {
      throw new BadRequestException(
        'Polar credentials and recurring products are required',
      );
    }
  }

  private fingerprint(configuration: PolarConfiguration): string {
    return createHash('sha256')
      .update(JSON.stringify(configuration))
      .digest('hex');
  }

  private async verify(configuration: PolarConfiguration): Promise<void> {
    const client = new Polar({
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

    try {
      const organizations = await client.organizations.listOrganizations({
        limit: 1,
      });
      await organizations[Symbol.asyncIterator]().next();

      const productIds = [
        ...(configuration.recurring
          ? [configuration.monthlyProductId, configuration.yearlyProductId]
          : []),
        configuration.oneTimeProductId,
      ].filter(Boolean);
      await Promise.all(productIds.map((id) => client.products.get({ id })));
    } catch {
      throw new ServiceUnavailableException(
        'Polar could not validate the draft configuration',
      );
    }
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
