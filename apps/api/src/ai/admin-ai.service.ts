import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  aiModelRoutes,
  aiModels,
  aiRequests,
  apiAuditLogs,
  providerIntegrations,
} from '@workspace/database';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  or,
  sql,
} from '@workspace/database/query';
import { z } from 'zod';
import {
  aiRequestKindSchema,
  createAdminAiModelSchema,
  testAdminAiProviderSchema,
  updateAdminAiModelSchema,
  updateAdminAiProviderSchema,
  updateAdminAiRouteSchema,
  type AdminAiConfiguration,
  type AdminAiModel,
  type AdminAiRoute,
  type AdminAiUsage,
  type AiRequestKind,
  type AuthSession,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { AppException } from '../platform/errors/app-exception';

const providerKey = 'openai' as const;
const providerLabel = 'OpenAI' as const;
const providerAad = 'ai:openai';
const openAiModelsUrl = 'https://api.openai.com/v1/models';

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
  search: 'text',
  ai_publishing: 'text',
};

type ProviderConfiguration = { apiKey: string };

@Injectable()
export class AdminAiService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async configuration(): Promise<AdminAiConfiguration> {
    const provider = await this.ensureProvider();
    const [models, routes] = await Promise.all([
      this.database.db
        .select()
        .from(aiModels)
        .where(eq(aiModels.providerKey, providerKey))
        .orderBy(aiModels.capability, aiModels.tier, aiModels.label),
      this.database.db.select().from(aiModelRoutes).orderBy(aiModelRoutes.kind),
    ]);
    return {
      provider: {
        providerKey,
        label: providerLabel,
        enabled: provider.enabled,
        readiness: this.publicReadiness(provider.readiness),
        apiKeyConfigured: Boolean(provider.configurationCiphertext),
        lastTestedAt: provider.lastTestedAt?.toISOString() ?? null,
        readinessIssues: provider.readinessIssues,
      },
      models: models.map((model) => this.serializeModel(model)),
      routes: routes.map((route) => this.serializeRoute(route)),
    };
  }

  async testProvider(input: unknown, session: AuthSession) {
    const parsed = testAdminAiProviderSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const provider = await this.ensureProvider();
    const configuration = this.resolveConfiguration(
      parsed.data.apiKey,
      provider.configurationCiphertext,
    );
    const availableModels = await this.verifyOpenAi(configuration.apiKey);
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
      testedAt: testedAt.toISOString(),
      availableModelIds: [...availableModels].sort(),
    };
  }

  async updateProvider(input: unknown, session: AuthSession) {
    const parsed = updateAdminAiProviderSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const provider = await this.ensureProvider();
    const configuration = parsed.data.apiKey
      ? { apiKey: parsed.data.apiKey }
      : this.decryptConfiguration(provider.configurationCiphertext);
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
      ? this.encryption().encrypt(JSON.stringify(configuration), providerAad)
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
          capabilities: ['text', 'image', 'video'],
          enabledCapabilityKeys: parsed.data.enabled
            ? ['text', 'image', 'video']
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
    await this.ensureProvider();
    try {
      const [created] = await this.database.db
        .insert(aiModels)
        .values({ providerKey, ...parsed.data })
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
    const [updated] = await this.database.db
      .update(aiModels)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(aiModels.id, modelId.data),
          eq(aiModels.providerKey, providerKey),
        ),
      )
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
    const values =
      expectedCapability === null
        ? {
            ...parsed.data,
            primaryModelId: null,
            fallbackModelId: null,
            reasoningEffort: 'none' as const,
          }
        : parsed.data;
    if (
      values.primaryModelId &&
      values.fallbackModelId === values.primaryModelId
    ) {
      throw new AppException(
        'AI_MODEL_ROUTE_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const ids = [values.primaryModelId, values.fallbackModelId].filter(
      (value): value is string => Boolean(value),
    );
    const models = ids.length
      ? await this.database.db
          .select()
          .from(aiModels)
          .where(inArray(aiModels.id, ids))
      : [];
    if (
      models.length !== ids.length ||
      models.some(
        (model) =>
          model.providerKey !== providerKey ||
          model.capability !== expectedCapability ||
          (values.enabled && (!model.enabled || model.deprecated)),
      ) ||
      (values.enabled && expectedCapability && !values.primaryModelId)
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

  private async ensureProvider() {
    await this.database.db
      .insert(providerIntegrations)
      .values({
        providerKey,
        enabled: false,
        readiness: 'disabled',
        capabilities: ['text', 'image', 'video'],
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
    apiKey: string | undefined,
    ciphertext: string | null,
  ) {
    const configuration = apiKey
      ? { apiKey }
      : this.decryptConfiguration(ciphertext);
    if (!configuration) {
      throw new AppException(
        'AI_PROVIDER_CONFIGURATION_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return configuration;
  }

  private decryptConfiguration(
    ciphertext: string | null,
  ): ProviderConfiguration | null {
    if (!ciphertext) return null;
    try {
      const parsed = JSON.parse(
        this.encryption().decrypt(ciphertext, providerAad),
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

  private serializeModel(model: typeof aiModels.$inferSelect): AdminAiModel {
    return {
      id: model.id,
      providerKey,
      modelId: model.modelId,
      label: model.label,
      capability: model.capability,
      tier: model.tier,
      enabled: model.enabled,
      deprecated: model.deprecated,
      inputPriceMicrousdPerMillion: model.inputPriceMicrousdPerMillion,
      outputPriceMicrousdPerMillion: model.outputPriceMicrousdPerMillion,
      unitPriceMicrousd: model.unitPriceMicrousd,
    };
  }

  private serializeRoute(
    route: typeof aiModelRoutes.$inferSelect,
  ): AdminAiRoute {
    return {
      kind: route.kind,
      primaryModelId: route.primaryModelId,
      fallbackModelId: route.fallbackModelId,
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

  private fingerprint(apiKey: string) {
    return createHash('sha256').update(apiKey, 'utf8').digest('hex');
  }

  private encryption() {
    return new Aes256GcmService(
      this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'),
    );
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
