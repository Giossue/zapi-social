import {
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  metaIntegrationConfigurationSchema,
  metaIntegrationProviderKey,
  testMetaIntegrationSchema,
  updateMetaIntegrationSchema,
  type AuthSession,
  type ChannelOAuthProviderKey,
  metaCapabilityScopeDefaults,
  type MetaCapabilityScopes,
  type MetaIntegration,
  type MetaIntegrationConfiguration,
  type TestMetaIntegrationResponse,
  testWhatsAppStatusIntegrationSchema,
  updateWhatsAppStatusIntegrationSchema,
  whatsappStatusIntegrationConfigurationSchema,
  whatsappStatusIntegrationProviderKey,
  type TestWhatsAppStatusIntegrationResponse,
  type UpdateWhatsAppStatusIntegrationInput,
  type WhatsAppStatusIntegration,
  type WhatsAppStatusIntegrationConfiguration,
  googleDriveIntegrationConfigurationSchema,
  googleDriveIntegrationProviderKey,
  testGoogleDriveIntegrationSchema,
  updateGoogleDriveIntegrationSchema,
  type GoogleDriveIntegration,
  type GoogleDriveIntegrationConfiguration,
  type PortalGoogleDriveConfiguration,
  type TestGoogleDriveIntegrationResponse,
} from '@workspace/contracts';
import { providerIntegrations } from '@workspace/database';
import { eq } from '@workspace/database/query';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { AppException } from '../platform/errors/app-exception';

/** Solo claves: el rótulo y la descripción los pone la interfaz. */
const metaCapabilities = [
  { key: 'facebook_page' as const },
  { key: 'instagram_profile' as const },
];

const whatsappStatusCapabilities = [{ key: 'whatsapp_status' as const }];

export type OAuthProviderConfiguration = {
  clientId: string;
  clientSecret: string;
  capabilityScopes?: MetaCapabilityScopes;
  /** LinkedIn: versión de la Posts API en formato YYYYMM. */
  apiVersion?: string;
};

type MetaRow = Pick<
  typeof providerIntegrations.$inferSelect,
  | 'enabled'
  | 'enabledCapabilityKeys'
  | 'configurationCiphertext'
  | 'testedConfigFingerprint'
  | 'lastTestedAt'
> & { readiness?: string };

type GoogleDriveRow = Pick<
  typeof providerIntegrations.$inferSelect,
  | 'enabled'
  | 'configurationCiphertext'
  | 'testedConfigFingerprint'
  | 'lastTestedAt'
> & { readiness?: string };

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  async getMeta(): Promise<MetaIntegration> {
    const row = await this.metaRow();
    return this.toMetaResponse(row);
  }

  async getGoogleDrive(): Promise<GoogleDriveIntegration> {
    return this.toGoogleDriveResponse(await this.googleDriveRow());
  }

  async testGoogleDrive(
    input: unknown,
    session: AuthSession,
  ): Promise<TestGoogleDriveIntegrationResponse> {
    const parsed = testGoogleDriveIntegrationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    await this.verifyGoogleDriveSelection(
      parsed.data.accessToken,
      parsed.data.selection.providerFileId,
      parsed.data.selection.resourceKey,
    );

    const testedAt = new Date();
    const fingerprint = this.googleDriveConfigurationFingerprint(
      parsed.data.configuration,
    );
    const row = await this.googleDriveRow();
    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey: googleDriveIntegrationProviderKey,
        enabled: row?.enabled ?? false,
        readiness: row?.enabled ? 'untested' : 'disabled',
        capabilities: ['file_import'],
        enabledCapabilityKeys: row?.enabled ? ['file_import'] : [],
        configurationCiphertext: row?.configurationCiphertext ?? null,
        testedConfigFingerprint: fingerprint,
        lastTestedAt: testedAt,
        lastTestedByPlatformAdminId: session.user.id,
        updatedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          testedConfigFingerprint: fingerprint,
          lastTestedAt: testedAt,
          lastTestedByPlatformAdminId: session.user.id,
          updatedByUserId: session.user.id,
          updatedAt: testedAt,
        },
      });

    return { testedAt: testedAt.toISOString() };
  }

  async saveGoogleDrive(
    input: unknown,
    session: AuthSession,
  ): Promise<GoogleDriveIntegration> {
    const parsed = updateGoogleDriveIntegrationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const row = await this.googleDriveRow();
    const configuration = parsed.data.configuration;
    const fingerprint = this.googleDriveConfigurationFingerprint(configuration);
    const tested = row?.testedConfigFingerprint === fingerprint;
    if (parsed.data.enabled && !tested) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const configurationCiphertext = this.encryption().encrypt(
      JSON.stringify(configuration),
      googleDriveIntegrationProviderKey,
    );
    const readiness = parsed.data.enabled
      ? tested
        ? 'ready'
        : 'untested'
      : 'disabled';
    const readinessIssues =
      parsed.data.enabled && !tested ? ['configuration_requires_test'] : [];
    const now = new Date();

    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey: googleDriveIntegrationProviderKey,
        enabled: parsed.data.enabled,
        readiness,
        capabilities: ['file_import'],
        enabledCapabilityKeys: parsed.data.enabled ? ['file_import'] : [],
        configurationCiphertext,
        readinessIssues,
        testedConfigFingerprint: row?.testedConfigFingerprint ?? null,
        lastTestedAt: row?.lastTestedAt ?? null,
        updatedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          enabled: parsed.data.enabled,
          readiness,
          capabilities: ['file_import'],
          enabledCapabilityKeys: parsed.data.enabled ? ['file_import'] : [],
          configurationCiphertext,
          readinessIssues,
          updatedByUserId: session.user.id,
          updatedAt: now,
        },
      });

    return this.toGoogleDriveResponse({
      enabled: parsed.data.enabled,
      readiness,
      configurationCiphertext,
      testedConfigFingerprint: row?.testedConfigFingerprint ?? null,
      lastTestedAt: row?.lastTestedAt ?? null,
    });
  }

  async readGoogleDrivePortalConfiguration(): Promise<PortalGoogleDriveConfiguration> {
    const row = await this.googleDriveRow();
    const configuration = this.decryptGoogleDriveConfiguration(
      row?.configurationCiphertext,
    );
    const ready = Boolean(
      row?.enabled && row.readiness === 'ready' && configuration,
    );

    return {
      enabled: ready,
      oauthClientId: ready ? (configuration?.oauthClientId ?? null) : null,
      browserApiKey: ready ? (configuration?.browserApiKey ?? null) : null,
      appId: ready ? (configuration?.appId ?? null) : null,
      configurationFingerprint:
        ready && configuration
          ? this.googleDriveConfigurationFingerprint(configuration)
          : null,
    };
  }

  /**
   * Validates the draft against Meta before it is stored. Only its SHA-256
   * fingerprint and audit timestamp are persisted; the draft itself is never logged.
   */
  async testMeta(
    input: unknown,
    session: AuthSession,
  ): Promise<TestMetaIntegrationResponse> {
    const parsed = testMetaIntegrationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const row = await this.metaRow();
    const configuration = this.resolveDraftConfiguration(
      parsed.data.configuration,
      row,
    );
    await this.verifyMetaConfiguration(configuration);

    const testedAt = new Date();
    const fingerprint = this.configurationFingerprint(configuration);
    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey: metaIntegrationProviderKey,
        enabled: row?.enabled ?? false,
        readiness: this.readiness(
          row?.enabled ?? false,
          Boolean(row?.configurationCiphertext),
          false,
        ),
        capabilities: metaCapabilities.map((capability) => capability.key),
        enabledCapabilityKeys: row?.enabledCapabilityKeys ?? [],
        configurationCiphertext: row?.configurationCiphertext ?? null,
        testedConfigFingerprint: fingerprint,
        lastTestedAt: testedAt,
        lastTestedByPlatformAdminId: session.user.id,
        updatedByUserId: row ? undefined : session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          testedConfigFingerprint: fingerprint,
          lastTestedAt: testedAt,
          lastTestedByPlatformAdminId: session.user.id,
          updatedAt: testedAt,
        },
      });

    return { testedAt: testedAt.toISOString() };
  }

  async saveMeta(
    input: unknown,
    session: AuthSession,
  ): Promise<MetaIntegration> {
    const parsed = updateMetaIntegrationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const row = await this.metaRow();
    const values = parsed.data;
    const configuration = values.configuration
      ? this.resolveDraftConfiguration(values.configuration, row)
      : this.decryptConfiguration(row?.configurationCiphertext);
    const fingerprint = configuration
      ? this.configurationFingerprint(configuration)
      : null;
    const tested = Boolean(
      fingerprint && row?.testedConfigFingerprint === fingerprint,
    );
    const configured = Boolean(configuration);
    const readiness = this.readiness(values.enabled, configured, tested);
    const readinessIssues = this.readinessIssues(
      values.enabled,
      configured,
      tested,
    );
    const configurationCiphertext = configuration
      ? this.encryption().encrypt(
          JSON.stringify(configuration),
          metaIntegrationProviderKey,
        )
      : (row?.configurationCiphertext ?? null);

    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey: metaIntegrationProviderKey,
        enabled: values.enabled,
        readiness,
        capabilities: metaCapabilities.map((capability) => capability.key),
        enabledCapabilityKeys: values.enabledCapabilityKeys,
        configurationCiphertext,
        readinessIssues,
        testedConfigFingerprint: row?.testedConfigFingerprint ?? null,
        lastTestedAt: row?.lastTestedAt ?? null,
        updatedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          enabled: values.enabled,
          readiness,
          capabilities: metaCapabilities.map((capability) => capability.key),
          enabledCapabilityKeys: values.enabledCapabilityKeys,
          configurationCiphertext,
          readinessIssues,
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        },
      });

    return this.toMetaResponse({
      enabled: values.enabled,
      enabledCapabilityKeys: values.enabledCapabilityKeys,
      configurationCiphertext,
      testedConfigFingerprint: row?.testedConfigFingerprint ?? null,
      lastTestedAt: row?.lastTestedAt ?? null,
    });
  }

  async getWhatsAppStatus(): Promise<WhatsAppStatusIntegration> {
    const row = await this.whatsAppStatusRow();
    return this.toWhatsAppStatusResponse(row);
  }

  /**
   * Calls only GOWA's read-only device listing. The remote response and draft
   * credentials are intentionally discarded; only a fingerprint and audit time persist.
   */
  async testWhatsAppStatus(
    input: unknown,
    session: AuthSession,
  ): Promise<TestWhatsAppStatusIntegrationResponse> {
    const parsed = testWhatsAppStatusIntegrationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const row = await this.whatsAppStatusRow();
    const configuration = this.resolveWhatsAppStatusDraftConfiguration(
      parsed.data.configuration,
      row,
    );
    await this.verifyWhatsAppStatusConfiguration(configuration);

    const testedAt = new Date();
    const fingerprint =
      this.whatsAppStatusConfigurationFingerprint(configuration);
    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey: whatsappStatusIntegrationProviderKey,
        enabled: row?.enabled ?? false,
        readiness: this.readiness(
          row?.enabled ?? false,
          Boolean(row?.configurationCiphertext),
          false,
        ),
        capabilities: whatsappStatusCapabilities.map(
          (capability) => capability.key,
        ),
        enabledCapabilityKeys: row?.enabledCapabilityKeys ?? [],
        configurationCiphertext: row?.configurationCiphertext ?? null,
        testedConfigFingerprint: fingerprint,
        lastTestedAt: testedAt,
        lastTestedByPlatformAdminId: session.user.id,
        updatedByUserId: row ? undefined : session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          testedConfigFingerprint: fingerprint,
          lastTestedAt: testedAt,
          lastTestedByPlatformAdminId: session.user.id,
          updatedAt: testedAt,
        },
      });

    return { testedAt: testedAt.toISOString() };
  }

  async saveWhatsAppStatus(
    input: unknown,
    session: AuthSession,
  ): Promise<WhatsAppStatusIntegration> {
    const parsed = updateWhatsAppStatusIntegrationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const row = await this.whatsAppStatusRow();
    const values: UpdateWhatsAppStatusIntegrationInput = parsed.data;
    const configuration = values.configuration
      ? this.resolveWhatsAppStatusDraftConfiguration(values.configuration, row)
      : this.decryptWhatsAppStatusConfiguration(row?.configurationCiphertext);
    const fingerprint = configuration
      ? this.whatsAppStatusConfigurationFingerprint(configuration)
      : null;
    const tested = Boolean(
      fingerprint && row?.testedConfigFingerprint === fingerprint,
    );
    const configured = Boolean(configuration);
    if (values.enabled && !tested) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    const readiness = this.readiness(values.enabled, configured, tested);
    const readinessIssues = this.readinessIssues(
      values.enabled,
      configured,
      tested,
    );
    const configurationCiphertext = configuration
      ? this.encryption().encrypt(
          JSON.stringify(configuration),
          whatsappStatusIntegrationProviderKey,
        )
      : (row?.configurationCiphertext ?? null);
    const enabledCapabilityKeys = values.enabled ? ['whatsapp_status'] : [];

    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey: whatsappStatusIntegrationProviderKey,
        enabled: values.enabled,
        readiness,
        capabilities: whatsappStatusCapabilities.map(
          (capability) => capability.key,
        ),
        enabledCapabilityKeys,
        configurationCiphertext,
        readinessIssues,
        testedConfigFingerprint: row?.testedConfigFingerprint ?? null,
        lastTestedAt: row?.lastTestedAt ?? null,
        updatedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          enabled: values.enabled,
          readiness,
          capabilities: whatsappStatusCapabilities.map(
            (capability) => capability.key,
          ),
          enabledCapabilityKeys,
          configurationCiphertext,
          readinessIssues,
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        },
      });

    return this.toWhatsAppStatusResponse({
      enabled: values.enabled,
      enabledCapabilityKeys,
      configurationCiphertext,
      testedConfigFingerprint: row?.testedConfigFingerprint ?? null,
      lastTestedAt: row?.lastTestedAt ?? null,
    });
  }

  async readWhatsAppStatusConfiguration(): Promise<WhatsAppStatusIntegrationConfiguration> {
    const row = await this.whatsAppStatusRow();
    const configuration = this.decryptWhatsAppStatusConfiguration(
      row?.configurationCiphertext,
    );
    const fingerprint = configuration
      ? this.whatsAppStatusConfigurationFingerprint(configuration)
      : null;

    if (
      !row ||
      !row.enabled ||
      row.readiness !== 'ready' ||
      !configuration ||
      !fingerprint ||
      row.testedConfigFingerprint !== fingerprint
    ) {
      throw new AppException(
        'OAUTH_PROVIDER_NOT_READY',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return configuration;
  }

  async readOAuthConfiguration(
    providerKey: ChannelOAuthProviderKey,
  ): Promise<OAuthProviderConfiguration> {
    if (providerKey !== metaIntegrationProviderKey) {
      // LinkedIn, X y TikTok guardan su configuración con el servicio genérico
      // de proveedores de canal, no con el schema de Meta.
      return this.readStoredOAuthConfiguration(providerKey);
    }

    const row = await this.metaRow();
    const configuration = this.decryptConfiguration(
      row?.configurationCiphertext,
    );
    const fingerprint = configuration
      ? this.configurationFingerprint(configuration)
      : null;

    if (
      !row ||
      !row.enabled ||
      !configuration ||
      !fingerprint ||
      row.testedConfigFingerprint !== fingerprint
    ) {
      throw new AppException(
        'OAUTH_PROVIDER_NOT_READY',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return configuration;
  }

  private async readStoredOAuthConfiguration(
    providerKey: Exclude<
      ChannelOAuthProviderKey,
      typeof metaIntegrationProviderKey
    >,
  ): Promise<OAuthProviderConfiguration> {
    const [row] = await this.database.db
      .select({
        enabled: providerIntegrations.enabled,
        readiness: providerIntegrations.readiness,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
      })
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, providerKey))
      .limit(1);

    if (!row || !row.enabled || row.readiness !== 'ready') {
      throw new AppException(
        'OAUTH_PROVIDER_NOT_READY',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const values = this.decryptChannelProviderValues(
      providerKey,
      row.configurationCiphertext,
    );
    // TikTok llama `clientKey` a lo que el resto llama `clientId`; se unifica
    // aquí para que la conexión no tenga que saber de esa diferencia.
    const clientId = values.clientId ?? values.clientKey;
    const clientSecret = values.clientSecret;
    if (!clientId || !clientSecret) {
      throw new AppException(
        'OAUTH_PROVIDER_CONFIGURATION_INVALID',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { clientId, clientSecret, apiVersion: values.apiVersion };
  }

  private decryptChannelProviderValues(
    providerKey: string,
    ciphertext: string | null,
  ): Record<string, string> {
    if (!ciphertext) return {};
    try {
      const parsed: unknown = JSON.parse(
        this.encryption().decrypt(ciphertext, providerKey),
      );
      if (typeof parsed !== 'object' || parsed === null) return {};
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') values[key] = value;
      }
      return values;
    } catch {
      return {};
    }
  }

  private async whatsAppStatusRow(): Promise<MetaRow | undefined> {
    const [row] = await this.database.db
      .select({
        enabled: providerIntegrations.enabled,
        readiness: providerIntegrations.readiness,
        enabledCapabilityKeys: providerIntegrations.enabledCapabilityKeys,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
        testedConfigFingerprint: providerIntegrations.testedConfigFingerprint,
        lastTestedAt: providerIntegrations.lastTestedAt,
      })
      .from(providerIntegrations)
      .where(
        eq(
          providerIntegrations.providerKey,
          whatsappStatusIntegrationProviderKey,
        ),
      )
      .limit(1);
    return row;
  }

  private async googleDriveRow(): Promise<GoogleDriveRow | undefined> {
    const [row] = await this.database.db
      .select({
        enabled: providerIntegrations.enabled,
        readiness: providerIntegrations.readiness,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
        testedConfigFingerprint: providerIntegrations.testedConfigFingerprint,
        lastTestedAt: providerIntegrations.lastTestedAt,
      })
      .from(providerIntegrations)
      .where(
        eq(providerIntegrations.providerKey, googleDriveIntegrationProviderKey),
      )
      .limit(1);
    return row;
  }

  private toGoogleDriveResponse(
    row: GoogleDriveRow | undefined,
  ): GoogleDriveIntegration {
    const configuration = this.decryptGoogleDriveConfiguration(
      row?.configurationCiphertext,
    );
    const enabled = row?.enabled ?? false;
    const readiness = enabled
      ? configuration
        ? row?.readiness === 'ready'
          ? 'ready'
          : 'untested'
        : 'incomplete'
      : 'disabled';

    return {
      providerKey: googleDriveIntegrationProviderKey,
      label: 'Google Drive',
      enabled,
      readiness,
      oauthClientId: configuration?.oauthClientId ?? null,
      browserApiKey: configuration?.browserApiKey ?? null,
      appId: configuration?.appId ?? null,
      lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
    };
  }

  private decryptGoogleDriveConfiguration(
    ciphertext: string | null | undefined,
  ): GoogleDriveIntegrationConfiguration | null {
    if (!ciphertext) return null;
    try {
      const parsed = googleDriveIntegrationConfigurationSchema.safeParse(
        JSON.parse(
          this.encryption().decrypt(
            ciphertext,
            googleDriveIntegrationProviderKey,
          ),
        ),
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private googleDriveConfigurationFingerprint(
    configuration: GoogleDriveIntegrationConfiguration,
  ) {
    return createHash('sha256')
      .update(
        `${configuration.oauthClientId}\u0000${configuration.browserApiKey}\u0000${configuration.appId}`,
      )
      .digest('hex');
  }

  private async verifyGoogleDriveSelection(
    accessToken: string,
    providerFileId: string,
    resourceKey?: string,
  ) {
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(providerFileId)}`,
    );
    url.searchParams.set('fields', 'id,mimeType');
    url.searchParams.set('supportsAllDrives', 'true');
    try {
      const response = await fetch(url, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(resourceKey
            ? {
                'x-goog-drive-resource-keys': `${providerFileId}/${resourceKey}`,
              }
            : {}),
        },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Drive selection probe failed.');
      const body = (await response.json()) as {
        id?: unknown;
        mimeType?: unknown;
      };
      if (
        body.id !== providerFileId ||
        typeof body.mimeType !== 'string' ||
        (!body.mimeType.startsWith('image/') &&
          !body.mimeType.startsWith('video/'))
      ) {
        throw new Error('Drive selection is not supported media.');
      }
    } catch {
      throw new ServiceUnavailableException();
    }
  }

  private toWhatsAppStatusResponse(
    row: MetaRow | undefined,
  ): WhatsAppStatusIntegration {
    const configuration = this.decryptWhatsAppStatusConfiguration(
      row?.configurationCiphertext,
    );
    const fingerprint = configuration
      ? this.whatsAppStatusConfigurationFingerprint(configuration)
      : null;
    const tested = Boolean(
      fingerprint && row?.testedConfigFingerprint === fingerprint,
    );
    const enabled = row?.enabled ?? false;
    const enabledCapabilityKeys = new Set(row?.enabledCapabilityKeys ?? []);

    return {
      providerKey: whatsappStatusIntegrationProviderKey,
      label: 'WhatsApp Status',
      enabled,
      readiness: this.readiness(enabled, Boolean(configuration), tested),
      capabilities: whatsappStatusCapabilities.map((capability) => ({
        ...capability,
        enabled: enabledCapabilityKeys.has(capability.key),
      })),
      baseUrl: configuration?.baseUrl ?? null,
      basicAuthUsername: configuration?.basicAuthUsername ?? null,
      basicAuthPasswordConfigured: Boolean(configuration),
      lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
    };
  }

  private async metaRow(): Promise<MetaRow | undefined> {
    const [row] = await this.database.db
      .select({
        enabled: providerIntegrations.enabled,
        readiness: providerIntegrations.readiness,
        enabledCapabilityKeys: providerIntegrations.enabledCapabilityKeys,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
        testedConfigFingerprint: providerIntegrations.testedConfigFingerprint,
        lastTestedAt: providerIntegrations.lastTestedAt,
      })
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, metaIntegrationProviderKey))
      .limit(1);
    return row;
  }

  private toMetaResponse(row: MetaRow | undefined): MetaIntegration {
    const configuration = this.decryptConfiguration(
      row?.configurationCiphertext,
    );
    const fingerprint = configuration
      ? this.configurationFingerprint(configuration)
      : null;
    const tested = Boolean(
      fingerprint && row?.testedConfigFingerprint === fingerprint,
    );
    const enabled = row?.enabled ?? false;
    const enabledCapabilityKeys = new Set(row?.enabledCapabilityKeys ?? []);

    return {
      providerKey: metaIntegrationProviderKey,
      label: 'Meta',
      enabled,
      readiness: this.readiness(enabled, Boolean(configuration), tested),
      capabilities: metaCapabilities.map((capability) => ({
        ...capability,
        enabled: enabledCapabilityKeys.has(capability.key),
        callbackUrl: this.callbackUrl(),
      })),
      capabilityScopes:
        configuration?.capabilityScopes ?? metaCapabilityScopeDefaults,
      clientId: configuration?.clientId ?? null,
      secretConfigured: Boolean(configuration),
      lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
    };
  }

  private resolveDraftConfiguration(
    configuration: {
      clientId: string;
      clientSecret?: string;
      capabilityScopes?: MetaCapabilityScopes;
    },
    row: MetaRow | undefined,
  ): MetaIntegrationConfiguration {
    const stored = this.decryptConfiguration(row?.configurationCiphertext);
    const candidate = {
      ...configuration,
      clientSecret: configuration.clientSecret ?? stored?.clientSecret,
      capabilityScopes:
        configuration.capabilityScopes ??
        stored?.capabilityScopes ??
        metaCapabilityScopeDefaults,
    };
    const parsed = metaIntegrationConfigurationSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    return parsed.data;
  }

  private resolveWhatsAppStatusDraftConfiguration(
    configuration: {
      baseUrl: string;
      basicAuthUsername: string;
      basicAuthPassword?: string;
    },
    row: MetaRow | undefined,
  ): WhatsAppStatusIntegrationConfiguration {
    const stored = this.decryptWhatsAppStatusConfiguration(
      row?.configurationCiphertext,
    );
    const candidate = {
      ...configuration,
      baseUrl: configuration.baseUrl.replace(/\/+$/, ''),
      basicAuthPassword:
        configuration.basicAuthPassword ?? stored?.basicAuthPassword,
    };
    const parsed =
      whatsappStatusIntegrationConfigurationSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    return parsed.data;
  }

  private decryptWhatsAppStatusConfiguration(
    ciphertext: string | null | undefined,
  ): WhatsAppStatusIntegrationConfiguration | null {
    if (!ciphertext) return null;

    try {
      const parsed = whatsappStatusIntegrationConfigurationSchema.safeParse(
        JSON.parse(
          this.encryption().decrypt(
            ciphertext,
            whatsappStatusIntegrationProviderKey,
          ),
        ),
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async verifyWhatsAppStatusConfiguration(
    configuration: WhatsAppStatusIntegrationConfiguration,
  ): Promise<void> {
    try {
      const response = await fetch(`${configuration.baseUrl}/devices`, {
        method: 'GET',
        headers: {
          authorization: `Basic ${Buffer.from(
            `${configuration.basicAuthUsername}:${configuration.basicAuthPassword}`,
          ).toString('base64')}`,
          accept: 'application/json',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !this.isGoWaSuccess(body)) {
        throw new Error('GOWA device probe failed.');
      }
    } catch {
      throw new ServiceUnavailableException();
    }
  }

  private isGoWaSuccess(value: unknown): boolean {
    return Boolean(
      value &&
      typeof value === 'object' &&
      (!('code' in value) || String(value.code).toUpperCase() === 'SUCCESS'),
    );
  }

  private whatsAppStatusConfigurationFingerprint(
    configuration: WhatsAppStatusIntegrationConfiguration,
  ): string {
    return createHash('sha256')
      .update(
        `${configuration.baseUrl}\u0000${configuration.basicAuthUsername}\u0000${configuration.basicAuthPassword}`,
      )
      .digest('hex');
  }

  private decryptConfiguration(
    ciphertext: string | null | undefined,
  ): MetaIntegrationConfiguration | null {
    if (!ciphertext) return null;

    try {
      const parsed = metaIntegrationConfigurationSchema.safeParse(
        JSON.parse(
          this.encryption().decrypt(ciphertext, metaIntegrationProviderKey),
        ),
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async verifyMetaConfiguration(
    configuration: MetaIntegrationConfiguration,
  ): Promise<void> {
    const url = new URL(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(configuration.clientId)}`,
    );
    url.searchParams.set('fields', 'id');
    url.searchParams.set(
      'access_token',
      `${configuration.clientId}|${configuration.clientSecret}`,
    );

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      });
      const body: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !this.isVerifiedMetaApp(body, configuration.clientId)
      ) {
        throw new Error('Meta app verification failed.');
      }
    } catch {
      throw new ServiceUnavailableException();
    }
  }

  private isVerifiedMetaApp(value: unknown, clientId: string): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      typeof value.id === 'string' &&
      value.id === clientId
    );
  }

  private configurationFingerprint(
    configuration: MetaIntegrationConfiguration,
  ): string {
    return createHash('sha256')
      .update(`${configuration.clientId}\u0000${configuration.clientSecret}`)
      .digest('hex');
  }

  private readiness(enabled: boolean, configured: boolean, tested: boolean) {
    if (!enabled) return 'disabled' as const;
    if (!configured) return 'incomplete' as const;
    return tested ? ('ready' as const) : ('untested' as const);
  }

  private readinessIssues(
    enabled: boolean,
    configured: boolean,
    tested: boolean,
  ): string[] {
    if (!enabled) return [];
    if (!configured) return ['configuration_required'];
    return tested ? [] : ['configuration_requires_test'];
  }

  private callbackUrl(): string {
    return new URL(
      '/v1/oauth/channels/meta/callback',
      this.config.getOrThrow<string>('API_PUBLIC_ORIGIN'),
    ).toString();
  }

  private encryption() {
    return new Aes256GcmService(
      this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'),
    );
  }
}
