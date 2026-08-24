import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  aiModelRoutes,
  aiModels,
  aiRequests,
  apiAuditLogs,
  providerIntegrations,
  users,
  workspaces,
} from '@workspace/database';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from '@workspace/database/query';
import { z } from 'zod';
import {
  adminAiReportQuerySchema,
  adminAiRequestsQuerySchema,
  aiRequestKindSchema,
  createAdminAiModelSchema,
  testAdminAiProviderSchema,
  updateAdminAiModelSchema,
  updateAdminAiProviderSchema,
  updateAdminAiRouteSchema,
  type AdminAiConfiguration,
  type AdminAiModel,
  type AdminAiReport,
  type AdminAiRequestsResponse,
  type AdminAiProviderKey,
  type AdminAiRoute,
  type AdminAiUsage,
  type AiModelMode,
  type AiRequestKind,
  type AuthSession,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { AppException } from '../platform/errors/app-exception';

const openAiModelsUrl = 'https://api.openai.com/v1/models';
const atlasCloudBalanceUrl = 'https://api.atlascloud.ai/public/v1/balance';

const providerSpecs: Record<
  AdminAiProviderKey,
  {
    label: string;
    aad: string;
    capabilities: Array<'text' | 'image' | 'video'>;
  }
> = {
  openai: { label: 'OpenAI', aad: 'ai:openai', capabilities: ['text'] },
  atlascloud: {
    label: 'AtlasCloud',
    aad: 'ai:atlascloud',
    capabilities: ['image', 'video'],
  },
};

const providerKeys = Object.keys(providerSpecs) as AdminAiProviderKey[];

const capabilityByKind: Record<
  AiRequestKind,
  'text' | 'image' | 'video' | null
> = {
  content: 'text',
  image: 'image',
  video: 'video',
  repurpose: 'text',
  planner: 'text',
  review: 'text',
  timing: null,
  search: null,
  ai_publishing: 'text',
};

type ProviderConfiguration = { apiKey: string };

const mediaModesByKind: Partial<
  Record<AiRequestKind, { primary: AiModelMode; reference: AiModelMode[] }>
> = {
  image: { primary: 'text-to-image', reference: ['image-to-image'] },
  video: {
    primary: 'text-to-video',
    reference: ['image-to-video', 'reference-to-video'],
  },
};

@Injectable()
export class AdminAiService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async configuration(): Promise<AdminAiConfiguration> {
    await this.ensureProviders();
    const [providers, models, routes] = await Promise.all([
      this.database.db
        .select()
        .from(providerIntegrations)
        .where(inArray(providerIntegrations.providerKey, providerKeys)),
      this.database.db
        .select()
        .from(aiModels)
        .where(inArray(aiModels.providerKey, providerKeys))
        .orderBy(
          aiModels.providerKey,
          aiModels.capability,
          aiModels.tier,
          aiModels.label,
        ),
      this.database.db.select().from(aiModelRoutes).orderBy(aiModelRoutes.kind),
    ]);
    return {
      providers: providerKeys.map((providerKey) => {
        const provider = providers.find(
          (candidate) => candidate.providerKey === providerKey,
        );
        if (!provider) throw this.failed();
        const spec = providerSpecs[providerKey];
        return {
          providerKey,
          label: spec.label,
          capabilities: spec.capabilities,
          enabled: provider.enabled,
          readiness: this.publicReadiness(provider.readiness),
          apiKeyConfigured: Boolean(provider.configurationCiphertext),
          lastTestedAt: provider.lastTestedAt?.toISOString() ?? null,
          readinessIssues: provider.readinessIssues,
        };
      }),
      models: models.map((model) => this.serializeModel(model)),
      routes: routes.map((route) => this.serializeRoute(route)),
    };
  }

  async testProvider(
    providerKeyValue: string,
    input: unknown,
    session: AuthSession,
  ) {
    const providerKey = this.parseProviderKey(providerKeyValue);
    const parsed = testAdminAiProviderSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const provider = await this.ensureProvider(providerKey);
    const configuration = this.resolveConfiguration(
      providerKey,
      parsed.data.apiKey,
      provider.configurationCiphertext,
    );
    const availableModels = await this.verifyProvider(
      providerKey,
      configuration.apiKey,
    );
    const testedAt = new Date();
    const fingerprint = this.fingerprint(configuration.apiKey);
    const replacementPending = Boolean(
      parsed.data.apiKey &&
      provider.configurationCiphertext &&
      provider.testedConfigFingerprint !== fingerprint,
    );
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(providerIntegrations)
        .set({
          testedConfigFingerprint: fingerprint,
          lastTestedAt: testedAt,
          lastTestedByPlatformAdminId: session.user.id,
          readiness: provider.enabled
            ? replacementPending
              ? 'untested'
              : 'ready'
            : 'disabled',
          readinessIssues: replacementPending
            ? ['configuration_requires_save']
            : [],
          updatedAt: testedAt,
        })
        .where(eq(providerIntegrations.providerKey, providerKey));
      await tx.insert(apiAuditLogs).values({
        actorUserId: session.user.id,
        event: 'admin.ai_provider_tested',
        subjectType: 'provider_integration',
        metadata: { providerKey, availableModelCount: availableModels.size },
      });
    });
    return {
      providerKey,
      testedAt: testedAt.toISOString(),
      availableModelIds: [...availableModels].sort(),
    };
  }

  async updateProvider(
    providerKeyValue: string,
    input: unknown,
    session: AuthSession,
  ) {
    const providerKey = this.parseProviderKey(providerKeyValue);
    const parsed = updateAdminAiProviderSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const provider = await this.ensureProvider(providerKey);
    const configuration = parsed.data.apiKey
      ? { apiKey: parsed.data.apiKey }
      : this.decryptConfiguration(
          providerKey,
          provider.configurationCiphertext,
        );
    const configured = Boolean(configuration);
    const fingerprint = configuration
      ? this.fingerprint(configuration.apiKey)
      : null;
    const tested = Boolean(
      fingerprint && provider.testedConfigFingerprint === fingerprint,
    );
    if (parsed.data.enabled && (!configured || !tested)) {
      throw new AppException(
        'AI_PROVIDER_CONFIGURATION_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const ciphertext = configuration
      ? this.encryption().encrypt(
          JSON.stringify(configuration),
          providerSpecs[providerKey].aad,
        )
      : null;
    const readiness = parsed.data.enabled
      ? tested
        ? 'ready'
        : 'untested'
      : 'disabled';
    const issues = !parsed.data.enabled
      ? []
      : !configured
        ? ['configuration_required']
        : tested
          ? []
          : ['configuration_requires_test'];
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(providerIntegrations)
        .set({
          enabled: parsed.data.enabled,
          readiness,
          capabilities: providerSpecs[providerKey].capabilities,
          enabledCapabilityKeys: parsed.data.enabled
            ? providerSpecs[providerKey].capabilities
            : [],
          configurationCiphertext: ciphertext,
          readinessIssues: issues,
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(providerIntegrations.providerKey, providerKey));
      await tx.insert(apiAuditLogs).values({
        actorUserId: session.user.id,
        event: 'admin.ai_provider_updated',
        subjectType: 'provider_integration',
        metadata: { providerKey, enabled: parsed.data.enabled },
      });
    });
    return this.configuration();
  }

  async createModel(input: unknown, session: AuthSession) {
    const parsed = createAdminAiModelSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    await this.ensureProvider(parsed.data.providerKey);
    const { modes, ...modelValues } = parsed.data;
    try {
      const [created] = await this.database.db
        .insert(aiModels)
        .values({
          ...modelValues,
          metadata: { modes },
        })
        .returning();
      if (!created) throw this.failed();
      await this.auditModel(session, 'created', created.id, {
        modelId: created.modelId,
      });
      return this.serializeModel(created);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw this.invalid();
      throw error;
    }
  }

  async updateModel(id: string, input: unknown, session: AuthSession) {
    const modelId = z.uuid().safeParse(id);
    const parsed = updateAdminAiModelSchema.safeParse(input);
    if (!modelId.success || !parsed.success) throw this.invalid();
    const [existing] = await this.database.db
      .select()
      .from(aiModels)
      .where(eq(aiModels.id, modelId.data))
      .limit(1);
    if (!existing) {
      throw new AppException('AI_MODEL_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (parsed.data.enabled === false || parsed.data.deprecated === true) {
      const [activeRoute] = await this.database.db
        .select({ id: aiModelRoutes.id })
        .from(aiModelRoutes)
        .where(
          and(
            eq(aiModelRoutes.enabled, true),
            or(
              eq(aiModelRoutes.primaryModelId, modelId.data),
              eq(aiModelRoutes.fallbackModelId, modelId.data),
              eq(aiModelRoutes.referenceModelId, modelId.data),
              eq(aiModelRoutes.referenceFallbackModelId, modelId.data),
            ),
          ),
        )
        .limit(1);
      if (activeRoute) {
        throw new AppException(
          'AI_MODEL_ROUTE_INVALID',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }
    const { modes, ...modelValues } = parsed.data;
    const [updated] = await this.database.db
      .update(aiModels)
      .set({
        ...modelValues,
        ...(modes
          ? {
              metadata: {
                ...(existing.metadata ?? {}),
                modes,
              },
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(aiModels.id, modelId.data))
      .returning();
    if (!updated) {
      throw new AppException('AI_MODEL_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    await this.auditModel(session, 'updated', updated.id, {
      changedFields: Object.keys(parsed.data),
    });
    return this.serializeModel(updated);
  }

  async updateRoute(kindValue: string, input: unknown, session: AuthSession) {
    const kind = aiRequestKindSchema.safeParse(kindValue);
    const parsed = updateAdminAiRouteSchema.safeParse(input);
    if (!kind.success || !parsed.success) throw this.invalid();
    const expectedCapability = capabilityByKind[kind.data];
    const mediaModes = mediaModesByKind[kind.data];
    const values =
      expectedCapability === null
        ? {
            ...parsed.data,
            primaryModelId: null,
            fallbackModelId: null,
            referenceModelId: null,
            referenceFallbackModelId: null,
            reasoningEffort: 'none' as const,
          }
        : mediaModes
          ? { ...parsed.data, reasoningEffort: 'none' as const }
          : parsed.data;
    if (
      (values.primaryModelId &&
        values.fallbackModelId === values.primaryModelId) ||
      (values.referenceModelId &&
        values.referenceFallbackModelId === values.referenceModelId)
    ) {
      throw new AppException(
        'AI_MODEL_ROUTE_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const ids = [
      ...new Set(
        [
          values.primaryModelId,
          values.fallbackModelId,
          values.referenceModelId,
          values.referenceFallbackModelId,
        ].filter((value): value is string => Boolean(value)),
      ),
    ];
    const models = ids.length
      ? await this.database.db
          .select()
          .from(aiModels)
          .where(inArray(aiModels.id, ids))
      : [];
    const byId = new Map(models.map((model) => [model.id, model]));
    const primary = values.primaryModelId
      ? byId.get(values.primaryModelId)
      : null;
    const fallback = values.fallbackModelId
      ? byId.get(values.fallbackModelId)
      : null;
    const reference = values.referenceModelId
      ? byId.get(values.referenceModelId)
      : null;
    const referenceFallback = values.referenceFallbackModelId
      ? byId.get(values.referenceFallbackModelId)
      : null;
    const invalidModels =
      models.length !== ids.length ||
      models.some(
        (model) =>
          model.capability !== expectedCapability ||
          (values.enabled && (!model.enabled || model.deprecated)),
      );
    const invalidProviders = mediaModes
      ? models.some((model) => model.providerKey !== 'atlascloud')
      : models.some((model) => model.providerKey !== 'openai');
    const invalidFallback =
      Boolean(fallback && primary?.providerKey !== fallback.providerKey) ||
      Boolean(
        referenceFallback &&
        reference?.providerKey !== referenceFallback.providerKey,
      );
    const invalidModes = mediaModes
      ? !this.modelSupportsMode(primary, [mediaModes.primary]) ||
        !this.modelSupportsMode(reference, mediaModes.reference) ||
        Boolean(
          fallback && !this.modelSupportsMode(fallback, [mediaModes.primary]),
        ) ||
        Boolean(
          referenceFallback &&
          !this.modelSupportsMode(referenceFallback, mediaModes.reference),
        )
      : Boolean(values.referenceModelId || values.referenceFallbackModelId);
    if (
      invalidModels ||
      invalidProviders ||
      invalidFallback ||
      invalidModes ||
      (values.enabled && expectedCapability && !primary) ||
      (values.enabled && mediaModes && !reference)
    ) {
      throw new AppException(
        'AI_MODEL_ROUTE_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const now = new Date();
    const [route] = await this.database.db
      .insert(aiModelRoutes)
      .values({
        kind: kind.data,
        ...values,
        updatedByUserId: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: aiModelRoutes.kind,
        set: {
          ...values,
          updatedByUserId: session.user.id,
          updatedAt: now,
        },
      })
      .returning();
    if (!route) throw this.failed();
    await this.database.db.insert(apiAuditLogs).values({
      actorUserId: session.user.id,
      event: 'admin.ai_route_updated',
      subjectType: 'ai_model_route',
      subjectId: route.id,
      metadata: { kind: route.kind },
    });
    return this.serializeRoute(route);
  }

  async usage(daysValue: unknown): Promise<AdminAiUsage> {
    const parsedDays = Number(daysValue);
    const days = Math.min(
      365,
      Math.max(1, Number.isFinite(parsedDays) ? Math.floor(parsedDays) : 30),
    );
    const since = new Date(Date.now() - days * 86_400_000);
    const [totals, byModel] = await Promise.all([
      this.database.db
        .select({
          requests: sql<number>`count(*)::int`,
          succeeded: sql<number>`count(*) filter (where ${aiRequests.status} = 'succeeded')::int`,
          failed: sql<number>`count(*) filter (where ${aiRequests.status} = 'failed')::int`,
          inputTokens: sql<number>`coalesce(sum(${aiRequests.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${aiRequests.outputTokens}), 0)::int`,
          estimatedCostMicrousd: sql<number>`coalesce(sum(${aiRequests.estimatedCostMicrousd}), 0)::int`,
          averageLatencyMs: sql<number>`coalesce(avg(${aiRequests.latencyMs}), 0)::int`,
        })
        .from(aiRequests)
        .where(gte(aiRequests.createdAt, since)),
      this.database.db
        .select({
          model: sql<string>`coalesce(${aiRequests.model}, 'internal')`,
          requests: sql<number>`count(*)::int`,
          inputTokens: sql<number>`coalesce(sum(${aiRequests.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${aiRequests.outputTokens}), 0)::int`,
          estimatedCostMicrousd: sql<number>`coalesce(sum(${aiRequests.estimatedCostMicrousd}), 0)::int`,
        })
        .from(aiRequests)
        .where(gte(aiRequests.createdAt, since))
        .groupBy(aiRequests.model)
        .orderBy(desc(sql`count(*)`)),
    ]);
    const total = totals[0];
    return {
      periodDays: days,
      requests: total?.requests ?? 0,
      succeeded: total?.succeeded ?? 0,
      failed: total?.failed ?? 0,
      inputTokens: total?.inputTokens ?? 0,
      outputTokens: total?.outputTokens ?? 0,
      estimatedCostMicrousd: total?.estimatedCostMicrousd ?? 0,
      averageLatencyMs: total?.averageLatencyMs ?? 0,
      byModel,
    };
  }

  private async ensureProviders() {
    await Promise.all(providerKeys.map((key) => this.ensureProvider(key)));
  }

  private async ensureProvider(providerKey: AdminAiProviderKey) {
    const spec = providerSpecs[providerKey];
    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey,
        enabled: false,
        readiness: 'disabled',
        capabilities: spec.capabilities,
        enabledCapabilityKeys: [],
        readinessIssues: [],
      })
      .onConflictDoNothing();
    const [provider] = await this.database.db
      .select()
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, providerKey))
      .limit(1);
    if (!provider) throw this.failed();
    return provider;
  }

  private resolveConfiguration(
    providerKey: AdminAiProviderKey,
    apiKey: string | undefined,
    ciphertext: string | null,
  ) {
    const configuration = apiKey
      ? { apiKey }
      : this.decryptConfiguration(providerKey, ciphertext);
    if (!configuration) {
      throw new AppException(
        'AI_PROVIDER_CONFIGURATION_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return configuration;
  }

  private decryptConfiguration(
    providerKey: AdminAiProviderKey,
    ciphertext: string | null,
  ): ProviderConfiguration | null {
    if (!ciphertext) return null;
    try {
      const parsed = JSON.parse(
        this.encryption().decrypt(ciphertext, providerSpecs[providerKey].aad),
      ) as unknown;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('apiKey' in parsed) ||
        typeof parsed.apiKey !== 'string' ||
        parsed.apiKey.length < 20
      ) {
        return null;
      }
      return { apiKey: parsed.apiKey };
    } catch {
      return null;
    }
  }

  private async verifyProvider(
    providerKey: AdminAiProviderKey,
    apiKey: string,
  ) {
    if (providerKey === 'atlascloud') {
      return this.verifyAtlasCloud(apiKey);
    }
    return this.verifyOpenAi(apiKey);
  }

  private async verifyOpenAi(apiKey: string) {
    let response: Response;
    try {
      response = await fetch(openAiModelsUrl, {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new AppException('AI_PROVIDER_NOT_READY', HttpStatus.BAD_GATEWAY);
    }
    if (!response.ok) {
      throw new AppException(
        'AI_PROVIDER_CONFIGURATION_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const payload = (await response.json()) as {
      data?: Array<{ id?: unknown }>;
    };
    return new Set(
      (payload.data ?? [])
        .map((model) => model.id)
        .filter((id): id is string => typeof id === 'string'),
    );
  }

  private async verifyAtlasCloud(apiKey: string) {
    let response: Response;
    try {
      response = await fetch(atlasCloudBalanceUrl, {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new AppException('AI_PROVIDER_NOT_READY', HttpStatus.BAD_GATEWAY);
    }
    if (response.status === 401 || (!response.ok && response.status !== 403)) {
      throw new AppException(
        'AI_PROVIDER_CONFIGURATION_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return new Set<string>();
  }

  private serializeModel(model: typeof aiModels.$inferSelect): AdminAiModel {
    return {
      id: model.id,
      providerKey: this.parseProviderKey(model.providerKey),
      modelId: model.modelId,
      label: model.label,
      capability: model.capability,
      tier: model.tier,
      enabled: model.enabled,
      deprecated: model.deprecated,
      inputPriceMicrousdPerMillion: model.inputPriceMicrousdPerMillion,
      outputPriceMicrousdPerMillion: model.outputPriceMicrousdPerMillion,
      unitPriceMicrousd: model.unitPriceMicrousd,
      modes: this.modelModes(model),
    };
  }

  private serializeRoute(
    route: typeof aiModelRoutes.$inferSelect,
  ): AdminAiRoute {
    return {
      kind: route.kind,
      primaryModelId: route.primaryModelId,
      fallbackModelId: route.fallbackModelId,
      referenceModelId: route.referenceModelId,
      referenceFallbackModelId: route.referenceFallbackModelId,
      reasoningEffort: route.reasoningEffort,
      costUnits: route.costUnits,
      enabled: route.enabled,
    };
  }

  private async auditModel(
    session: AuthSession,
    action: string,
    modelId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.database.db.insert(apiAuditLogs).values({
      actorUserId: session.user.id,
      event: `admin.ai_model_${action}`,
      subjectType: 'ai_model',
      subjectId: modelId,
      metadata,
    });
  }

  private publicReadiness(value: string) {
    if (value === 'ready' || value === 'disabled' || value === 'untested') {
      return value;
    }
    if (value === 'incomplete' || value === 'error') return value;
    return 'incomplete' as const;
  }

  private parseProviderKey(value: string): AdminAiProviderKey {
    if (value === 'openai' || value === 'atlascloud') return value;
    throw this.invalid();
  }

  private modelModes(model: typeof aiModels.$inferSelect): AiModelMode[] {
    const modes = Array.isArray(model.metadata.modes)
      ? model.metadata.modes
      : [];
    return modes.filter(
      (mode): mode is AiModelMode =>
        mode === 'text-to-image' ||
        mode === 'image-to-image' ||
        mode === 'text-to-video' ||
        mode === 'image-to-video' ||
        mode === 'reference-to-video',
    );
  }

  private modelSupportsMode(
    model: typeof aiModels.$inferSelect | null | undefined,
    modes: AiModelMode[],
  ) {
    return Boolean(
      model && this.modelModes(model).some((mode) => modes.includes(mode)),
    );
  }

  private fingerprint(apiKey: string) {
    return createHash('sha256').update(apiKey, 'utf8').digest('hex');
  }

  private encryption() {
    return new Aes256GcmService(
      this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'),
    );
  }

  async requests(query: unknown): Promise<AdminAiRequestsResponse> {
    const parsed = adminAiRequestsQuerySchema.safeParse(query ?? {});
    if (!parsed.success) throw this.invalid();
    const { q, provider, kind, status, from, to, page, limit } = parsed.data;

    const filters = [
      provider ? eq(aiRequests.provider, provider) : undefined,
      kind ? eq(aiRequests.kind, kind) : undefined,
      status ? eq(aiRequests.status, status) : undefined,
      from
        ? gte(aiRequests.createdAt, new Date(`${from}T00:00:00.000Z`))
        : undefined,
      to
        ? lte(aiRequests.createdAt, new Date(`${to}T23:59:59.999Z`))
        : undefined,
      q
        ? or(
            ilike(users.displayName, `%${q}%`),
            ilike(users.email, `%${q}%`),
            ilike(workspaces.name, `%${q}%`),
          )
        : undefined,
    ].filter(Boolean);
    const where = filters.length ? and(...filters) : undefined;

    const [rows, totals, providers] = await Promise.all([
      this.database.db
        .select({
          id: aiRequests.id,
          createdAt: aiRequests.createdAt,
          kind: aiRequests.kind,
          status: aiRequests.status,
          provider: aiRequests.provider,
          model: aiRequests.model,
          workspaceName: workspaces.name,
          userName: users.displayName,
          userEmail: users.email,
          inputTokens: aiRequests.inputTokens,
          outputTokens: aiRequests.outputTokens,
          estimatedCostMicrousd: aiRequests.estimatedCostMicrousd,
          latencyMs: aiRequests.latencyMs,
          errorCode: aiRequests.errorCode,
        })
        .from(aiRequests)
        .innerJoin(users, eq(users.id, aiRequests.requestedByUserId))
        .innerJoin(workspaces, eq(workspaces.id, aiRequests.workspaceId))
        .where(where)
        .orderBy(desc(aiRequests.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.database.db
        .select({ total: sql<number>`count(*)::int` })
        .from(aiRequests)
        .innerJoin(users, eq(users.id, aiRequests.requestedByUserId))
        .innerJoin(workspaces, eq(workspaces.id, aiRequests.workspaceId))
        .where(where),
      this.database.db
        .selectDistinct({ provider: aiRequests.provider })
        .from(aiRequests)
        .orderBy(asc(aiRequests.provider)),
    ]);

    return {
      requests: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
      providers: providers
        .map((row) => row.provider)
        .filter((value): value is string => Boolean(value)),
      page,
      limit,
      total: totals[0]?.total ?? 0,
    };
  }

  async report(query: unknown): Promise<AdminAiReport> {
    const parsed = adminAiReportQuerySchema.safeParse(query ?? {});
    if (!parsed.success) throw this.invalid();

    const today = new Date();
    const defaultFrom = new Date(today.getTime() - 29 * 86_400_000);
    const from = parsed.data.from ?? defaultFrom.toISOString().slice(0, 10);
    const to = parsed.data.to ?? today.toISOString().slice(0, 10);
    if (from > to) throw this.invalid();

    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T23:59:59.999Z`);
    const range = and(
      gte(aiRequests.createdAt, start),
      lte(aiRequests.createdAt, end),
    );
    const successRate = sql<number>`case when count(*) = 0 then 0 else round((count(*) filter (where ${aiRequests.status} = 'succeeded')::numeric / count(*)) * 100, 1) end`;

    const [totals, daily, byProvider] = await Promise.all([
      this.database.db
        .select({
          requests: sql<number>`count(*)::int`,
          succeeded: sql<number>`count(*) filter (where ${aiRequests.status} = 'succeeded')::int`,
          failed: sql<number>`count(*) filter (where ${aiRequests.status} = 'failed')::int`,
          tokens: sql<number>`coalesce(sum(${aiRequests.inputTokens} + ${aiRequests.outputTokens}), 0)::int`,
          estimatedCostMicrousd: sql<number>`coalesce(sum(${aiRequests.estimatedCostMicrousd}), 0)::int`,
          averageLatencyMs: sql<number>`coalesce(avg(${aiRequests.latencyMs}), 0)::int`,
          successRate,
        })
        .from(aiRequests)
        .where(range),
      this.database.db
        .select({
          date: sql<string>`to_char(${aiRequests.createdAt}, 'YYYY-MM-DD')`,
          requests: sql<number>`count(*)::int`,
          tokens: sql<number>`coalesce(sum(${aiRequests.inputTokens} + ${aiRequests.outputTokens}), 0)::int`,
          estimatedCostMicrousd: sql<number>`coalesce(sum(${aiRequests.estimatedCostMicrousd}), 0)::int`,
          averageLatencyMs: sql<number>`coalesce(avg(${aiRequests.latencyMs}), 0)::int`,
          successRate,
        })
        .from(aiRequests)
        .where(range)
        .groupBy(sql`to_char(${aiRequests.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(asc(sql`to_char(${aiRequests.createdAt}, 'YYYY-MM-DD')`)),
      this.database.db
        .select({
          provider: sql<string>`coalesce(${aiRequests.provider}, 'interno')`,
          requests: sql<number>`count(*)::int`,
          tokens: sql<number>`coalesce(sum(${aiRequests.inputTokens} + ${aiRequests.outputTokens}), 0)::int`,
          estimatedCostMicrousd: sql<number>`coalesce(sum(${aiRequests.estimatedCostMicrousd}), 0)::int`,
          successRate,
        })
        .from(aiRequests)
        .where(range)
        .groupBy(sql`coalesce(${aiRequests.provider}, 'interno')`)
        .orderBy(desc(sql`count(*)`)),
    ]);

    const total = totals[0];
    return {
      from,
      to,
      totals: {
        requests: total?.requests ?? 0,
        succeeded: total?.succeeded ?? 0,
        failed: total?.failed ?? 0,
        tokens: total?.tokens ?? 0,
        estimatedCostMicrousd: total?.estimatedCostMicrousd ?? 0,
        averageLatencyMs: total?.averageLatencyMs ?? 0,
        successRate: Number(total?.successRate ?? 0),
      },
      daily: daily.map((row) => ({
        ...row,
        successRate: Number(row.successRate),
      })),
      byProvider: byProvider.map((row) => ({
        ...row,
        successRate: Number(row.successRate),
      })),
    };
  }

  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private failed() {
    return new AppException(
      'AI_REQUEST_FAILED',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private isUniqueViolation(error: unknown) {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505',
    );
  }
}
