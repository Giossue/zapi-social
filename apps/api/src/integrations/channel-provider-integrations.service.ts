import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { providerIntegrations } from '@workspace/database';
import { eq } from '@workspace/database/query';
import {
  type ChannelProviderIntegration,
  type ChannelProviderIntegrationsResponse,
  type PortalChannelProviderKey,
  type TestChannelProviderIntegrationResponse,
  channelCapabilityCatalog,
  channelProvider,
  channelProviderCatalog,
  channelProviderValuesSchema,
  portalChannelProviderKeySchema,
  saveChannelProviderIntegrationSchema,
  testChannelProviderIntegrationSchema,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { AppException } from '../platform/errors/app-exception';
import {
  CHANNEL_PROVIDER_VERIFIERS,
  type ChannelProviderVerifier,
} from './channel-provider-verifier';

/**
 * Proveedores que traen pantalla propia porque necesitan más que un formulario.
 * Se siguen guardando aquí, pero la interfaz respeta su tarjeta.
 */
const customScreenProviders = new Set<PortalChannelProviderKey>([
  'meta',
  'whatsapp',
]);

type IntegrationRow = {
  enabled: boolean;
  enabledCapabilityKeys: string[];
  configurationCiphertext: string | null;
  testedConfigFingerprint: string | null;
  lastTestedAt: Date | null;
};

/**
 * Pantalla de integración de canal, servida desde el catálogo.
 *
 * Añadir una red es declararla en `channelProviderCatalog` y registrar su
 * verificador. Ni este servicio ni la interfaz cambian.
 */
@Injectable()
export class ChannelProviderIntegrationsService {
  private readonly verifiers: Map<
    PortalChannelProviderKey,
    ChannelProviderVerifier
  >;

  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
    private readonly config: ConfigService,
    @Optional()
    @Inject(CHANNEL_PROVIDER_VERIFIERS)
    verifiers: readonly ChannelProviderVerifier[] = [],
  ) {
    this.verifiers = new Map(
      verifiers.map((verifier) => [verifier.providerKey, verifier]),
    );
  }

  /**
   * Solo los proveedores sin pantalla propia. Meta y WhatsApp guardan su
   * configuración con otra clave y bajo su propio contrato; enseñarlos aquí
   * mostraría un formulario vacío que no es el suyo.
   */
  async list(): Promise<ChannelProviderIntegrationsResponse> {
    const providers = await Promise.all(
      channelProviderCatalog
        .filter((definition) => !customScreenProviders.has(definition.key))
        .map((definition) => this.get(definition.key)),
    );
    return { providers };
  }

  /** Capabilities listas para conectar, de los proveedores genéricos. */
  async readyCapabilityKeys(): Promise<string[]> {
    const { providers } = await this.list();
    return providers
      .filter((provider) => provider.enabled && provider.readiness === 'ready')
      .flatMap((provider) =>
        provider.capabilities
          .filter((capability) => capability.enabled)
          .map((capability) => capability.key),
      );
  }

  async get(
    providerKey: PortalChannelProviderKey,
  ): Promise<ChannelProviderIntegration> {
    const definition = channelProvider(providerKey);
    if (!definition) {
      throw new AppException('INTEGRATION_UNKNOWN', HttpStatus.NOT_FOUND);
    }

    const row = await this.row(providerKey);
    const stored = this.decrypt(providerKey, row?.configurationCiphertext);
    const configured = this.isConfigured(providerKey, stored);
    const tested = Boolean(
      stored &&
      row?.testedConfigFingerprint === this.fingerprint(providerKey, stored),
    );
    const enabled = row?.enabled ?? false;
    const enabledCapabilityKeys = new Set(row?.enabledCapabilityKeys ?? []);

    const values: Record<string, string> = {};
    const secretsConfigured: string[] = [];
    for (const field of definition.fields) {
      if (field.type === 'secret') {
        // Un secreto no vuelve nunca; solo se dice si está puesto.
        if (stored?.[field.key]) secretsConfigured.push(field.key);
        continue;
      }
      if (field.readOnly && field.key === 'callbackUrl') {
        values[field.key] = this.callbackUrl(providerKey);
        continue;
      }
      values[field.key] = stored?.[field.key] ?? '';
    }

    return {
      providerKey,
      definition,
      enabled,
      readiness: this.readiness(enabled, configured, tested),
      issues: this.issues(enabled, configured, tested, providerKey),
      values,
      secretsConfigured,
      capabilities: channelCapabilityCatalog
        .filter((capability) => capability.providerKey === providerKey)
        .map((capability) => ({
          key: capability.key,
          enabled: enabledCapabilityKeys.has(capability.key),
        })),
      lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
      hasCustomScreen: customScreenProviders.has(providerKey),
    };
  }

  async save(
    rawProviderKey: string,
    input: unknown,
  ): Promise<ChannelProviderIntegration> {
    const providerKey = this.requireProviderKey(rawProviderKey);
    const parsed = saveChannelProviderIntegrationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const row = await this.row(providerKey);
    const stored = this.decrypt(providerKey, row?.configurationCiphertext);
    const merged = this.merge(providerKey, stored, parsed.data.values);

    // Solo se acepta activar capabilities del propio proveedor.
    const own = new Set(
      channelCapabilityCatalog
        .filter((capability) => capability.providerKey === providerKey)
        .map((capability) => capability.key),
    );
    const enabledCapabilityKeys = parsed.data.enabledCapabilityKeys.filter(
      (key) => own.has(key),
    );

    const fingerprint = this.fingerprint(providerKey, merged);
    // Cambiar una credencial invalida la prueba anterior: si no, un proveedor
    // mal configurado seguiría contando como listo y el Portal abriría el canal.
    const testedConfigFingerprint =
      row?.testedConfigFingerprint === fingerprint ? fingerprint : null;

    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey,
        enabled: parsed.data.enabled,
        readiness: 'pending',
        enabledCapabilityKeys,
        configurationCiphertext: this.encrypt(providerKey, merged),
        testedConfigFingerprint,
        lastTestedAt: testedConfigFingerprint
          ? (row?.lastTestedAt ?? null)
          : null,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          enabled: parsed.data.enabled,
          enabledCapabilityKeys,
          configurationCiphertext: this.encrypt(providerKey, merged),
          testedConfigFingerprint,
          lastTestedAt: testedConfigFingerprint
            ? (row?.lastTestedAt ?? null)
            : null,
          updatedAt: new Date(),
        },
      });

    return this.get(providerKey);
  }

  async test(
    rawProviderKey: string,
    input: unknown,
  ): Promise<TestChannelProviderIntegrationResponse> {
    const providerKey = this.requireProviderKey(rawProviderKey);
    const parsed = testChannelProviderIntegrationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const verifier = this.verifiers.get(providerKey);
    // Sin verificador la integración no puede quedar lista: dar por buenas unas
    // credenciales sin comprobarlas abriría el canal en el Portal y el fallo
    // aparecería al publicar.
    if (!verifier) {
      return { ok: false, issue: 'verifier_unavailable' };
    }

    const row = await this.row(providerKey);
    const stored = this.decrypt(providerKey, row?.configurationCiphertext);
    const merged = this.merge(providerKey, stored, parsed.data.values);
    if (!this.isConfigured(providerKey, merged)) {
      return { ok: false, issue: 'configuration_required' };
    }

    const issue = await verifier.verify(merged);
    if (issue) return { ok: false, issue };

    const testedAt = new Date();
    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey,
        enabled: row?.enabled ?? false,
        readiness: 'pending',
        enabledCapabilityKeys: row?.enabledCapabilityKeys ?? [],
        configurationCiphertext: this.encrypt(providerKey, merged),
        testedConfigFingerprint: this.fingerprint(providerKey, merged),
        lastTestedAt: testedAt,
      })
      .onConflictDoUpdate({
        target: providerIntegrations.providerKey,
        set: {
          configurationCiphertext: this.encrypt(providerKey, merged),
          testedConfigFingerprint: this.fingerprint(providerKey, merged),
          lastTestedAt: testedAt,
          updatedAt: testedAt,
        },
      });

    return { ok: true, issue: null };
  }

  private requireProviderKey(value: string): PortalChannelProviderKey {
    const parsed = portalChannelProviderKeySchema.safeParse(value);
    if (!parsed.success || !channelProvider(parsed.data)) {
      throw new AppException('INTEGRATION_UNKNOWN', HttpStatus.NOT_FOUND);
    }
    return parsed.data;
  }

  private async row(
    providerKey: PortalChannelProviderKey,
  ): Promise<IntegrationRow | undefined> {
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

  /** Un valor vacío no pisa el secreto guardado: así se puede editar el resto. */
  private merge(
    providerKey: PortalChannelProviderKey,
    stored: Record<string, string> | null,
    incoming: Record<string, string>,
  ): Record<string, string> {
    const parsed = channelProviderValuesSchema(providerKey).safeParse(incoming);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    const merged = { ...(stored ?? {}) };
    for (const [key, value] of Object.entries(
      parsed.data as Record<string, string>,
    )) {
      if (value === '' && merged[key]) continue;
      merged[key] = value;
    }
    return merged;
  }

  private isConfigured(
    providerKey: PortalChannelProviderKey,
    values: Record<string, string> | null,
  ): boolean {
    if (!values) return false;
    const definition = channelProvider(providerKey);
    return Boolean(
      definition?.fields.every(
        (field) => !field.required || Boolean(values[field.key]),
      ),
    );
  }

  private fingerprint(
    providerKey: PortalChannelProviderKey,
    values: Record<string, string>,
  ): string {
    const definition = channelProvider(providerKey);
    const parts = (definition?.fields ?? [])
      .filter((field) => !field.readOnly)
      .map((field) => `${field.key}=${values[field.key] ?? ''}`);
    return createHash('sha256').update(parts.join('\u0000')).digest('hex');
  }

  private decrypt(
    providerKey: PortalChannelProviderKey,
    ciphertext: string | null | undefined,
  ): Record<string, string> | null {
    if (!ciphertext) return null;
    try {
      const parsed: unknown = JSON.parse(
        this.encryption.decrypt(ciphertext, providerKey),
      );
      if (typeof parsed !== 'object' || parsed === null) return null;
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') values[key] = value;
      }
      return values;
    } catch {
      return null;
    }
  }

  private encrypt(
    providerKey: PortalChannelProviderKey,
    values: Record<string, string>,
  ): string {
    return this.encryption.encrypt(JSON.stringify(values), providerKey);
  }

  private readiness(enabled: boolean, configured: boolean, tested: boolean) {
    if (!enabled) return 'disabled' as const;
    if (!configured) return 'incomplete' as const;
    return tested ? ('ready' as const) : ('untested' as const);
  }

  private issues(
    enabled: boolean,
    configured: boolean,
    tested: boolean,
    providerKey: PortalChannelProviderKey,
  ): string[] {
    if (!enabled) return [];
    if (!configured) return ['configuration_required'];
    if (!this.verifiers.has(providerKey)) return ['verifier_unavailable'];
    return tested ? [] : ['configuration_requires_test'];
  }

  private callbackUrl(providerKey: PortalChannelProviderKey): string {
    return new URL(
      `/v1/oauth/channels/${providerKey}/callback`,
      this.config.getOrThrow<string>('API_PUBLIC_ORIGIN'),
    ).toString();
  }
}
