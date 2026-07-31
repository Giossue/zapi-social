import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  integrationProviderKeySchema,
  updateProviderIntegrationSchema,
  type AuthSession,
  type ChannelOAuthProviderKey,
  type IntegrationProviderKey,
  type ProviderIntegration,
  type UpdateProviderIntegrationInput,
} from '@workspace/contracts';
import { providerIntegrations } from '@workspace/database';
import { eq } from '@workspace/database/query';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { AppException } from '../platform/errors/app-exception';

type ProviderDefinition = Pick<
  ProviderIntegration,
  | 'providerKey'
  | 'label'
  | 'description'
  | 'capabilities'
  | 'configurationFields'
>;

type StoredProvider = {
  enabled: boolean;
  configurationCiphertext: string | null;
};

const oauthProviderConfigurationSchema = z
  .object({
    clientId: z.string().trim().min(1).max(4096),
    clientSecret: z.string().trim().min(1).max(4096),
  })
  .strict();

export type OAuthProviderConfiguration = z.infer<
  typeof oauthProviderConfigurationSchema
>;

const providerDefinitions: ProviderDefinition[] = [
  {
    providerKey: 'facebook',
    label: 'Meta',
    description: 'Facebook Pages e Instagram Professional.',
    capabilities: ['Facebook Page', 'Instagram Profile'],
    configurationFields: [
      { key: 'clientId', label: 'Client ID', secret: false },
      { key: 'clientSecret', label: 'Client secret', secret: true },
    ],
  },
  {
    providerKey: 'linkedin',
    label: 'LinkedIn',
    description: 'Perfiles personales y páginas de organización.',
    capabilities: ['LinkedIn Profile', 'LinkedIn Page'],
    configurationFields: [
      { key: 'clientId', label: 'Client ID', secret: false },
      { key: 'clientSecret', label: 'Client secret', secret: true },
    ],
  },
  {
    providerKey: 'tiktok',
    label: 'TikTok',
    description: 'Perfiles de creador para publicación.',
    capabilities: ['TikTok Profile'],
    configurationFields: [
      { key: 'clientId', label: 'Client ID', secret: false },
      { key: 'clientSecret', label: 'Client secret', secret: true },
    ],
  },
  {
    providerKey: 'x',
    label: 'X',
    description: 'Perfiles X con OAuth 2.0 y PKCE.',
    capabilities: ['X Profile'],
    configurationFields: [
      { key: 'clientId', label: 'Client ID', secret: false },
      { key: 'clientSecret', label: 'Client secret', secret: true },
    ],
  },
  {
    providerKey: 'whatsapp-status',
    label: 'WhatsApp Status',
    description: 'Conexión mediante código QR y dispositivo dedicado.',
    capabilities: ['WhatsApp Status'],
    configurationFields: [
      { key: 'deviceToken', label: 'Token de dispositivo', secret: true },
    ],
  },
];

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  async list(): Promise<ProviderIntegration[]> {
    const rows = await this.database.db
      .select({
        providerKey: providerIntegrations.providerKey,
        enabled: providerIntegrations.enabled,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
      })
      .from(providerIntegrations);

    const storedByKey = new Map(rows.map((row) => [row.providerKey, row]));

    return providerDefinitions.map((definition) =>
      this.toResponse(definition, storedByKey.get(definition.providerKey)),
    );
  }

  async update(
    providerKeyInput: string,
    input: unknown,
    session: AuthSession,
  ): Promise<ProviderIntegration> {
    const parsedInput = updateProviderIntegrationSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    const validatedInput: UpdateProviderIntegrationInput = parsedInput.data;

    const providerKey =
      integrationProviderKeySchema.safeParse(providerKeyInput);
    if (!providerKey.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const definition = this.findDefinition(providerKey.data);
    this.assertConfigurationFields(definition, validatedInput.configuration);

    const [existing] = await this.database.db
      .select({
        enabled: providerIntegrations.enabled,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
      })
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, definition.providerKey))
      .limit(1);

    const enabled = validatedInput.enabled ?? existing?.enabled ?? false;
    const configurationCiphertext = validatedInput.configuration
      ? this.encryption().encrypt(
          JSON.stringify(validatedInput.configuration),
          definition.providerKey,
        )
      : (existing?.configurationCiphertext ?? null);
    const readiness = this.readiness(enabled, Boolean(configurationCiphertext));

    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey: definition.providerKey,
        enabled,
        readiness,
        capabilities: definition.capabilities,
        configurationCiphertext,
        updatedByUserId: session.user.id,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          enabled,
          readiness,
          capabilities: definition.capabilities,
          configurationCiphertext,
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        },
      });

    return this.toResponse(definition, { enabled, configurationCiphertext });
  }

  async readOAuthConfiguration(
    providerKey: ChannelOAuthProviderKey,
  ): Promise<OAuthProviderConfiguration> {
    const [integration] = await this.database.db
      .select({
        enabled: providerIntegrations.enabled,
        readiness: providerIntegrations.readiness,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
      })
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, providerKey))
      .limit(1);

    if (
      !integration ||
      !integration.enabled ||
      integration.readiness !== 'ready' ||
      !integration.configurationCiphertext
    ) {
      throw new AppException(
        'OAUTH_PROVIDER_NOT_READY',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const configuration = oauthProviderConfigurationSchema.safeParse(
        JSON.parse(
          this.encryption().decrypt(
            integration.configurationCiphertext,
            providerKey,
          ),
        ),
      );
      if (!configuration.success)
        throw new Error('Invalid OAuth configuration.');
      return configuration.data;
    } catch {
      throw new AppException(
        'OAUTH_PROVIDER_CONFIGURATION_INVALID',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private encryption() {
    return new Aes256GcmService(
      this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'),
    );
  }

  private findDefinition(
    providerKey: IntegrationProviderKey,
  ): ProviderDefinition {
    const definition = providerDefinitions.find(
      (provider) => provider.providerKey === providerKey,
    );
    if (!definition) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    return definition;
  }

  private assertConfigurationFields(
    definition: ProviderDefinition,
    configuration: UpdateProviderIntegrationInput['configuration'],
  ) {
    if (!configuration) return;

    const expectedKeys = definition.configurationFields
      .map((field) => field.key)
      .sort();
    const receivedKeys = Object.keys(configuration).sort();
    const isExactMatch =
      expectedKeys.length === receivedKeys.length &&
      expectedKeys.every((key, index) => key === receivedKeys[index]);

    if (!isExactMatch) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
  }

  private toResponse(
    definition: ProviderDefinition,
    stored: StoredProvider | undefined,
  ): ProviderIntegration {
    const enabled = stored?.enabled ?? false;
    const configured = Boolean(stored?.configurationCiphertext);

    return {
      ...definition,
      enabled,
      readiness: this.readiness(enabled, configured),
      configuredFields: configured ? definition.configurationFields.length : 0,
      requiredFields: definition.configurationFields.length,
    };
  }

  private readiness(
    enabled: boolean,
    configured: boolean,
  ): ProviderIntegration['readiness'] {
    if (!enabled) return 'disabled';
    return configured ? 'ready' : 'incomplete';
  }
}
