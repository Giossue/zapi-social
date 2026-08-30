import {
  originalStorageKey,
  thumbnailStorageKey,
} from '@workspace/file-ingestion';
import { createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { relative, resolve } from 'node:path';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  aiModelRoutes,
  aiModels,
  aiPublishingSchedules,
  aiRequests,
  aiWorkspaceSettings,
  captions,
  creditLedgerEntries,
  fileAssets,
  providerIntegrations,
  publishingPosts,
  socialAccounts,
  workspaceCreditAccounts,
} from '@workspace/database';
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
} from '@workspace/database/query';
import {
  aiRequestResultSchemas,
  type AiReasoningEffort,
  type AiRequestKind,
} from '@workspace/contracts';
import type { Job } from 'bullmq';
import sharp from 'sharp';
import { WorkerAuditService } from '../audit/worker-audit.service';
import { AutomationWebhookEventsService } from '../automation/automation-webhook-events.service';
import { DatabaseService } from '../database/database.service';
import { PlanAccessService } from '../plans/plan-access.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import {
  AI_REQUEST_JOB,
  AI_REQUEST_QUEUE,
  type AiRequestJobData,
} from './ai.constants';

type AiRequestRow = typeof aiRequests.$inferSelect;
type AiModelRow = typeof aiModels.$inferSelect;
type ProviderIntegrationRow = typeof providerIntegrations.$inferSelect;

type TextProviderKey = 'openai' | 'deepseek' | 'qwen' | 'anthropic';

type SupportedProviderKey = TextProviderKey | 'atlascloud';

type Execution = {
  provider: 'internal' | SupportedProviderKey;
  apiKey?: string;
  primaryModel: AiModelRow | null;
  fallbackModel: AiModelRow | null;
  reasoningEffort: AiReasoningEffort;
};

const chatCompletionsUrls: Record<'deepseek' | 'qwen', string> = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
};

const anthropicMessagesUrl = 'https://api.anthropic.com/v1/messages';
const anthropicVersion = '2023-06-01';

type Usage = {
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicrousd: number;
};

type GenerationOutcome = Usage & {
  result: Record<string, unknown>;
  provider: string;
  model: string | null;
  providerRequestId: string | null;
};

type OpenAiTextOutcome = Usage & {
  text: string;
  model: AiModelRow;
  providerRequestId: string | null;
};

@Injectable()
@Processor(AI_REQUEST_QUEUE, { concurrency: 2 })
export class AiRequestProcessor extends WorkerHost {
  private readonly storageRoot: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly audit: WorkerAuditService,
    private readonly events: AutomationWebhookEventsService,
    private readonly encryption: Aes256GcmService,
    private readonly planAccess: PlanAccessService,
    config: ConfigService,
  ) {
    super();
    this.storageRoot = resolve(
      config.get<string>('FILES_STORAGE_PATH') ?? './.data/files',
    );
  }

  async process(job: Job<AiRequestJobData>) {
    if (job.name !== AI_REQUEST_JOB) return;
    const jobId = String(job.id ?? `ai-${job.data.aiRequestId}`);
    const [request] = await this.database.db
      .update(aiRequests)
      .set({
        status: 'processing',
        progress: 5,
        jobId,
        startedAt: sql`coalesce(${aiRequests.startedAt}, now())`,
        errorCode: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiRequests.id, job.data.aiRequestId),
          eq(aiRequests.workspaceId, job.data.workspaceId),
          or(
            eq(aiRequests.status, 'queued'),
            and(
              eq(aiRequests.status, 'processing'),
              eq(aiRequests.jobId, jobId),
            ),
          ),
        ),
      )
      .returning();
    if (!request) return;
    const startedAt = Date.now();
    try {
      const module =
        request.kind === 'ai_publishing' ? 'ai-publishing' : 'ai-studio';
      if (
        !(await this.planAccess.moduleAvailable(request.workspaceId, module))
      ) {
        throw new AiProcessingError('PLAN_MODULE_DISABLED', true);
      }
      const execution = await this.resolveExecution(request);
      const outcome = await this.generate(request, execution);
      const resultSchema = aiRequestResultSchemas[request.kind];
      const validated = resultSchema.safeParse(outcome.result);
      if (!validated.success) {
        throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
      }
      const now = new Date();
      const completed = await this.database.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(aiRequests)
          .set({
            status: 'succeeded',
            progress: 100,
            result: validated.data,
            provider: outcome.provider,
            model: outcome.model,
            providerRequestId: outcome.providerRequestId,
            inputTokens: outcome.inputTokens,
            outputTokens: outcome.outputTokens,
            estimatedCostMicrousd: outcome.estimatedCostMicrousd,
            latencyMs: Date.now() - startedAt,
            completedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(aiRequests.id, request.id),
              eq(aiRequests.status, 'processing'),
              eq(aiRequests.jobId, jobId),
            ),
          )
          .returning({ id: aiRequests.id });
        if (!updated) return false;
        if (request.kind === 'ai_publishing') {
          const scheduleId =
            typeof request.input.scheduleId === 'string'
              ? request.input.scheduleId
              : null;
          if (scheduleId) {
            await tx
              .update(aiPublishingSchedules)
              .set({ lastRunAt: now, updatedAt: now })
              .where(
                and(
                  eq(aiPublishingSchedules.id, scheduleId),
                  eq(aiPublishingSchedules.workspaceId, request.workspaceId),
                ),
              );
          }
        }
        return true;
      });
      if (!completed) return;
      await this.audit.write({
        workspaceId: request.workspaceId,
        actorUserId: request.requestedByUserId,
        event: 'ai.request_processed',
        severity: 'success',
        outcome: 'succeeded',
        queueName: AI_REQUEST_QUEUE,
        jobId,
        attempt: job.attemptsMade,
        metadata: {
          aiRequestId: request.id,
          kind: request.kind,
          provider: outcome.provider,
          model: outcome.model,
          inputTokens: outcome.inputTokens,
          outputTokens: outcome.outputTokens,
          estimatedCostMicrousd: outcome.estimatedCostMicrousd,
        },
      });
    } catch (error) {
      const code =
        error instanceof AiProcessingError
          ? error.code
          : 'AI_PROVIDER_REQUEST_FAILED';
      const permanent = error instanceof AiProcessingError && error.permanent;
      const finalAttempt =
        permanent || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (finalAttempt) {
        await this.failAndRefund(request, code, Date.now() - startedAt);
      } else {
        await this.database.db
          .update(aiRequests)
          .set({
            status: 'queued',
            progress: 0,
            errorCode: code,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(aiRequests.id, request.id),
              eq(aiRequests.status, 'processing'),
              eq(aiRequests.jobId, jobId),
            ),
          );
      }
      await this.audit.write({
        workspaceId: request.workspaceId,
        actorUserId: request.requestedByUserId,
        event: 'ai.request_processed',
        severity: 'error',
        outcome: finalAttempt ? 'failed' : 'retrying',
        queueName: AI_REQUEST_QUEUE,
        jobId,
        attempt: job.attemptsMade,
        errorCode: code,
        metadata: { aiRequestId: request.id, kind: request.kind },
      });
      if (!finalAttempt) throw error;
    }
  }

  private async generate(
    request: AiRequestRow,
    execution: Execution,
  ): Promise<GenerationOutcome> {
    if (request.kind === 'timing') {
      return this.internalOutcome(
        await this.bestTiming(request),
        'internal-analytics',
      );
    }
    if (request.kind === 'search') {
      return this.internalOutcome(
        await this.search(request),
        'internal-search',
      );
    }
    if (request.kind === 'image') return this.generateImage(request, execution);
    if (request.kind === 'video') return this.generateVideo(request, execution);
    const settings = await this.settings(request.workspaceId);
    const generated = await this.generateText(
      request,
      execution,
      buildSystemPrompt(request.kind, settings),
    );
    const parsed = parseJson(generated.text);
    let result: Record<string, unknown>;
    if (request.kind === 'ai_publishing') {
      const text =
        parsed && typeof parsed.text === 'string' ? parsed.text.trim() : '';
      if (!text) {
        throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
      }
      const publishingPostIds = await this.createAiPublishingDrafts(
        request,
        text,
      );
      result = { text, publishingPostIds };
    } else {
      if (!parsed) {
        throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
      }
      result = parsed;
    }
    return {
      result,
      provider: execution.provider,
      model: generated.model.modelId,
      providerRequestId: generated.providerRequestId,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      estimatedCostMicrousd: generated.estimatedCostMicrousd,
    };
  }

  private async resolveExecution(request: AiRequestRow): Promise<Execution> {
    if (request.kind === 'timing' || request.kind === 'search') {
      return {
        provider: 'internal',
        primaryModel: null,
        fallbackModel: null,
        reasoningEffort: 'none',
      };
    }
    const [route] = await this.database.db
      .select()
      .from(aiModelRoutes)
      .where(eq(aiModelRoutes.kind, request.kind))
      .limit(1);
    if (!route?.enabled) {
      throw new AiProcessingError('AI_PROVIDER_NOT_CONFIGURED', true);
    }
    const usesReferences =
      (request.kind === 'image' || request.kind === 'video') &&
      Array.isArray(request.input.referenceAssetIds) &&
      request.input.referenceAssetIds.length > 0;
    const primaryModelId = usesReferences
      ? route.referenceModelId
      : route.primaryModelId;
    const fallbackModelId = usesReferences
      ? route.referenceFallbackModelId
      : route.fallbackModelId;
    const modelIds = [primaryModelId, fallbackModelId].filter(
      (value): value is string => Boolean(value),
    );
    const models: AiModelRow[] = modelIds.length
      ? await this.database.db
          .select()
          .from(aiModels)
          .where(inArray(aiModels.id, modelIds))
      : [];
    const configuredPrimaryModel =
      models.find((model) => model.id === primaryModelId) ?? null;
    const primaryModel =
      models.find((model) => model.modelId === request.model) ??
      configuredPrimaryModel;
    const fallbackModel =
      models.find(
        (model) =>
          model.id === fallbackModelId && model.id !== primaryModel?.id,
      ) ?? null;
    const provider = primaryModel
      ? await this.provider(primaryModel.providerKey)
      : null;
    if (
      !provider?.enabled ||
      provider.readiness !== 'ready' ||
      !provider.configurationCiphertext ||
      !primaryModel?.enabled ||
      primaryModel.deprecated
    ) {
      throw new AiProcessingError('AI_PROVIDER_NOT_CONFIGURED', true);
    }
    if (
      fallbackModel &&
      fallbackModel.providerKey !== primaryModel.providerKey
    ) {
      throw new AiProcessingError('AI_PROVIDER_NOT_CONFIGURED', true);
    }
    const providerKey = this.supportedProviderKey(primaryModel.providerKey);
    const apiKey = this.decryptApiKey(
      provider.configurationCiphertext,
      providerKey,
    );
    if (!apiKey) {
      throw new AiProcessingError('AI_PROVIDER_NOT_CONFIGURED', true);
    }
    return {
      provider: providerKey,
      apiKey,
      primaryModel,
      fallbackModel:
        fallbackModel?.enabled && !fallbackModel.deprecated
          ? fallbackModel
          : null,
      reasoningEffort: route.reasoningEffort,
    };
  }

  private async provider(
    providerKey: string,
  ): Promise<ProviderIntegrationRow | null> {
    const [provider] = await this.database.db
      .select()
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, providerKey))
      .limit(1);
    return provider ?? null;
  }

  private async generateText(
    request: AiRequestRow,
    execution: Execution,
    instructions: string,
  ): Promise<OpenAiTextOutcome> {
    const provider = execution.provider;
    if (
      provider === 'internal' ||
      provider === 'atlascloud' ||
      !execution.apiKey ||
      !execution.primaryModel
    ) {
      throw new AiProcessingError('AI_PROVIDER_NOT_CONFIGURED', true);
    }
    const models = [execution.primaryModel, execution.fallbackModel].filter(
      (model): model is AiModelRow => Boolean(model),
    );
    let lastError: AiProcessingError | null = null;
    for (const model of models) {
      let response: Response;
      try {
        response = await this.textProviderRequest(
          provider,
          execution,
          model,
          request,
          instructions,
        );
      } catch {
        lastError = new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
        continue;
      }
      if (!response.ok) {
        const transient = response.status === 429 || response.status >= 500;
        lastError = new AiProcessingError(
          response.status === 429
            ? 'AI_PROVIDER_RATE_LIMITED'
            : 'AI_PROVIDER_REQUEST_FAILED',
          !transient,
        );
        if (transient) continue;
        throw lastError;
      }
      const payload = (await response.json()) as Record<string, unknown>;
      const parsed = parseTextPayload(provider, payload);
      if (!parsed.text) {
        throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
      }
      return {
        text: parsed.text,
        model,
        providerRequestId: parsed.providerRequestId,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        estimatedCostMicrousd: estimateTextCost(
          model,
          parsed.inputTokens,
          parsed.outputTokens,
        ),
      };
    }
    if (lastError instanceof Error) throw lastError;
    throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
  }

  private textProviderRequest(
    provider: TextProviderKey,
    execution: Execution,
    model: AiModelRow,
    request: AiRequestRow,
    instructions: string,
  ): Promise<Response> {
    const userInput = `${request.prompt}\n\nContexto estructurado:\n${JSON.stringify(request.input)}`;
    const timeout = AbortSignal.timeout(120_000);
    if (provider === 'anthropic') {
      return fetch(anthropicMessagesUrl, {
        method: 'POST',
        headers: {
          'x-api-key': execution.apiKey ?? '',
          'anthropic-version': anthropicVersion,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: model.modelId,
          max_tokens: 8_000,
          system: instructions,
          messages: [{ role: 'user', content: userInput }],
        }),
        signal: timeout,
      });
    }
    if (provider === 'deepseek' || provider === 'qwen') {
      return fetch(chatCompletionsUrls[provider], {
        method: 'POST',
        headers: {
          authorization: `Bearer ${execution.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: model.modelId,
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: userInput },
          ],
          max_tokens: 8_000,
        }),
        signal: timeout,
      });
    }
    return fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${execution.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model.modelId,
        instructions,
        input: userInput,
        reasoning: { effort: execution.reasoningEffort },
        text: { verbosity: 'low' },
        max_output_tokens: 8_000,
        store: false,
        safety_identifier: safetyIdentifier(
          request.workspaceId,
          request.requestedByUserId,
        ),
      }),
      signal: timeout,
    });
  }

  private async generateImage(
    request: AiRequestRow,
    execution: Execution,
  ): Promise<GenerationOutcome> {
    if (
      execution.provider !== 'atlascloud' ||
      !execution.apiKey ||
      !execution.primaryModel
    ) {
      throw new AiProcessingError('AI_IMAGE_PROVIDER_NOT_CONFIGURED', true);
    }
    const references = await this.referenceImageDataUris(request, 10);
    const availableModels = [
      execution.primaryModel,
      execution.fallbackModel,
    ].filter((model): model is AiModelRow => Boolean(model));
    const models = request.providerRequestId
      ? availableModels.filter((model) => model.modelId === request.model)
      : availableModels;
    if (!models.length) {
      throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
    }
    let lastError: unknown = null;
    for (const [index, model] of models.entries()) {
      let predictionId =
        model.modelId === request.model ? request.providerRequestId : null;
      try {
        if (!predictionId) {
          predictionId = await this.submitAtlasPrediction(
            'generateImage',
            buildAtlasImagePayload(model.modelId, request, references),
            execution.apiKey,
          );
          await this.persistAtlasPrediction(
            request.id,
            predictionId,
            10,
            model.modelId,
          );
        }
        const prediction = await this.pollAtlasPrediction(
          request.id,
          predictionId,
          execution.apiKey,
          5 * 60_000,
          2_000,
        );
        if (prediction.hasNsfwContents.some(Boolean)) {
          throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
        }
        const outputUrl = firstAtlasOutput(prediction);
        if (!outputUrl) {
          throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
        }
        const buffer = await downloadPublicMedia(outputUrl, 30 * 1024 * 1024);
        return await this.storeAtlasImage(request, model, predictionId, buffer);
      } catch (error) {
        lastError = error;
        if (predictionId || index === models.length - 1) throw error;
      }
    }
    if (lastError instanceof Error) throw lastError;
    throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
  }

  private async generateVideo(
    request: AiRequestRow,
    execution: Execution,
  ): Promise<GenerationOutcome> {
    if (
      execution.provider !== 'atlascloud' ||
      !execution.apiKey ||
      !execution.primaryModel
    ) {
      throw new AiProcessingError('AI_VIDEO_PROVIDER_NOT_CONFIGURED', true);
    }
    const references = await this.referenceImageDataUris(request, 9);
    const availableModels = [
      execution.primaryModel,
      execution.fallbackModel,
    ].filter((model): model is AiModelRow => Boolean(model));
    const models = request.providerRequestId
      ? availableModels.filter((model) => model.modelId === request.model)
      : availableModels;
    if (!models.length) {
      throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
    }
    let lastError: unknown = null;
    for (const [index, model] of models.entries()) {
      let predictionId =
        model.modelId === request.model ? request.providerRequestId : null;
      try {
        if (!predictionId) {
          predictionId = await this.submitAtlasPrediction(
            'generateVideo',
            buildAtlasVideoPayload(model.modelId, request, references),
            execution.apiKey,
          );
          await this.persistAtlasPrediction(
            request.id,
            predictionId,
            10,
            model.modelId,
          );
        }
        const prediction = await this.pollAtlasPrediction(
          request.id,
          predictionId,
          execution.apiKey,
          10 * 60_000,
          5_000,
        );
        if (prediction.hasNsfwContents.some(Boolean)) {
          throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
        }
        const outputUrl = firstAtlasOutput(prediction);
        if (!outputUrl) {
          throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
        }
        const buffer = await downloadPublicMedia(outputUrl, 250 * 1024 * 1024);
        return await this.storeAtlasVideo(request, model, predictionId, buffer);
      } catch (error) {
        lastError = error;
        if (predictionId || index === models.length - 1) throw error;
      }
    }
    if (lastError instanceof Error) throw lastError;
    throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
  }

  private async referenceImageDataUris(request: AiRequestRow, maximum: number) {
    const ids = Array.isArray(request.input.referenceAssetIds)
      ? request.input.referenceAssetIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    if (!ids.length) return [];
    if (ids.length > maximum || new Set(ids).size !== ids.length) {
      throw new AiProcessingError('AI_IMAGE_REFERENCE_INVALID', true);
    }
    const rows = await this.database.db
      .select()
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.workspaceId, request.workspaceId),
          eq(fileAssets.status, 'ready'),
          inArray(fileAssets.id, ids),
        ),
      );
    const byId = new Map(rows.map((asset) => [asset.id, asset]));
    if (
      rows.length !== ids.length ||
      rows.some(
        (asset) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType) ||
          asset.sizeBytes > 30 * 1024 * 1024,
      )
    ) {
      throw new AiProcessingError('AI_IMAGE_REFERENCE_INVALID', true);
    }
    const values: string[] = [];
    for (const id of ids) {
      const asset = byId.get(id);
      if (!asset) {
        throw new AiProcessingError('AI_IMAGE_REFERENCE_INVALID', true);
      }
      const path = resolve(this.storageRoot, asset.storageKey);
      const pathFromRoot = relative(this.storageRoot, path);
      if (pathFromRoot.startsWith('..') || pathFromRoot.includes('\0')) {
        throw new AiProcessingError('AI_IMAGE_REFERENCE_INVALID', true);
      }
      const source = await readFile(path);
      if (source.length !== asset.sizeBytes) {
        throw new AiProcessingError('AI_IMAGE_REFERENCE_INVALID', true);
      }
      values.push(`data:${asset.mimeType};base64,${source.toString('base64')}`);
    }
    return values;
  }

  private async submitAtlasPrediction(
    endpoint: 'generateImage' | 'generateVideo',
    payload: Record<string, unknown>,
    apiKey: string,
  ) {
    let response: Response;
    try {
      response = await fetch(
        `https://api.atlascloud.ai/api/v1/model/${endpoint}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120_000),
        },
      );
    } catch {
      throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
    }
    if (!response.ok) {
      throw atlasResponseError(response.status);
    }
    const prediction = atlasPredictionPayload(await response.json());
    if (!prediction.id) {
      throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
    }
    return prediction.id;
  }

  private async pollAtlasPrediction(
    requestId: string,
    predictionId: string,
    apiKey: string,
    timeoutMilliseconds: number,
    intervalMilliseconds: number,
  ) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMilliseconds) {
      let response: Response;
      try {
        response = await fetch(
          `https://api.atlascloud.ai/api/v1/model/prediction/${encodeURIComponent(predictionId)}`,
          {
            headers: { authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(30_000),
          },
        );
      } catch {
        throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
      }
      if (!response.ok) throw atlasResponseError(response.status);
      const prediction = atlasPredictionPayload(await response.json());
      if (
        prediction.status === 'completed' ||
        prediction.status === 'succeeded'
      ) {
        return prediction;
      }
      if (
        prediction.status === 'failed' ||
        prediction.status === 'timeout' ||
        prediction.status === 'canceled' ||
        prediction.status === 'cancelled'
      ) {
        throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', true);
      }
      const elapsed = Date.now() - startedAt;
      const estimatedProgress =
        10 + Math.floor((elapsed / timeoutMilliseconds) * 80);
      await this.persistAtlasPrediction(
        requestId,
        predictionId,
        Math.max(10, Math.min(90, prediction.progress || estimatedProgress)),
      );
      await wait(intervalMilliseconds);
    }
    throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
  }

  private async persistAtlasPrediction(
    requestId: string,
    predictionId: string,
    progress: number,
    model?: string,
  ) {
    await this.database.db
      .update(aiRequests)
      .set({
        providerRequestId: predictionId,
        progress,
        ...(model ? { model } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(aiRequests.id, requestId), eq(aiRequests.status, 'processing')),
      );
  }

  private async storeAtlasImage(
    request: AiRequestRow,
    model: AiModelRow,
    predictionId: string,
    buffer: Buffer,
  ): Promise<GenerationOutcome> {
    if (!buffer.length || buffer.length > 30 * 1024 * 1024) {
      throw new AiProcessingError('AI_IMAGE_BINARY_INVALID', true);
    }
    const metadata = await sharp(buffer).metadata();
    if (
      !metadata.format ||
      !['png', 'jpeg', 'webp', 'avif'].includes(metadata.format)
    ) {
      throw new AiProcessingError('AI_IMAGE_BINARY_INVALID', true);
    }
    const id = randomUUID();
    const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
    const storageKey = originalStorageKey({
      workspaceId: request.workspaceId,
      assetId: id,
      extension,
    });
    const thumbnailKey = thumbnailStorageKey(request.workspaceId, id);
    const sourcePath = resolve(this.storageRoot, storageKey);
    const thumbnailPath = resolve(this.storageRoot, thumbnailKey);
    try {
      await mkdir(resolve(sourcePath, '..'), { recursive: true });
      await mkdir(resolve(thumbnailPath, '..'), { recursive: true });
      await writeFile(sourcePath, buffer);
      await sharp(buffer)
        .rotate()
        .resize({
          width: 640,
          height: 480,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toFile(thumbnailPath);
      const [asset] = await this.database.db
        .insert(fileAssets)
        .values({
          id,
          workspaceId: request.workspaceId,
          createdByUserId: request.requestedByUserId,
          storageKey,
          name: `AI ${request.prompt.slice(0, 80).trim()}.${extension}`,
          mimeType:
            metadata.format === 'jpeg'
              ? 'image/jpeg'
              : `image/${metadata.format}`,
          extension,
          sizeBytes: buffer.length,
          width: metadata.width ?? null,
          height: metadata.height ?? null,
          thumbnailKey,
          thumbnailStatus: 'ready',
          status: 'ready',
          metadata: {
            source: 'ai',
            aiRequestId: request.id,
            provider: 'atlascloud',
            model: model.modelId,
            providerRequestId: predictionId,
            referenceAssetIds: request.input.referenceAssetIds ?? [],
          },
        })
        .returning({ id: fileAssets.id });
      if (!asset) throw new AiProcessingError('AI_IMAGE_STORE_FAILED', false);
      return {
        result: {
          assets: [
            {
              fileAssetId: asset.id,
              width: metadata.width ?? null,
              height: metadata.height ?? null,
            },
          ],
          revisedPrompt: null,
        },
        provider: 'atlascloud',
        model: model.modelId,
        providerRequestId: predictionId,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostMicrousd: model.unitPriceMicrousd ?? 0,
      };
    } catch (error) {
      await Promise.all([
        rm(sourcePath, { force: true }),
        rm(thumbnailPath, { force: true }),
      ]);
      throw error;
    }
  }

  private async storeAtlasVideo(
    request: AiRequestRow,
    model: AiModelRow,
    predictionId: string,
    buffer: Buffer,
  ): Promise<GenerationOutcome> {
    if (
      buffer.length < 16 ||
      buffer.length > 250 * 1024 * 1024 ||
      buffer.subarray(4, 8).toString('ascii') !== 'ftyp'
    ) {
      throw new AiProcessingError('AI_VIDEO_BINARY_INVALID', true);
    }
    const durationSeconds =
      typeof request.input.durationSeconds === 'number'
        ? request.input.durationSeconds
        : 8;
    const ratio = request.input.aspectRatio;
    const dimensions =
      ratio === '16:9'
        ? { width: 1920, height: 1080 }
        : ratio === '1:1'
          ? { width: 1080, height: 1080 }
          : { width: 1080, height: 1920 };
    const id = randomUUID();
    const storageKey = originalStorageKey({
      workspaceId: request.workspaceId,
      assetId: id,
      extension: 'mp4',
    });
    const sourcePath = resolve(this.storageRoot, storageKey);
    try {
      await mkdir(resolve(sourcePath, '..'), { recursive: true });
      await writeFile(sourcePath, buffer);
      const [asset] = await this.database.db
        .insert(fileAssets)
        .values({
          id,
          workspaceId: request.workspaceId,
          createdByUserId: request.requestedByUserId,
          storageKey,
          name: `AI ${request.prompt.slice(0, 80).trim()}.mp4`,
          mimeType: 'video/mp4',
          extension: 'mp4',
          sizeBytes: buffer.length,
          width: dimensions.width,
          height: dimensions.height,
          thumbnailStatus: 'not_applicable',
          status: 'ready',
          metadata: {
            source: 'ai',
            aiRequestId: request.id,
            provider: 'atlascloud',
            model: model.modelId,
            providerRequestId: predictionId,
            durationSeconds,
            referenceAssetIds: request.input.referenceAssetIds ?? [],
          },
        })
        .returning({ id: fileAssets.id });
      if (!asset) throw new AiProcessingError('AI_VIDEO_STORE_FAILED', false);
      return {
        result: {
          fileAssetId: asset.id,
          durationSeconds,
          width: dimensions.width,
          height: dimensions.height,
        },
        provider: 'atlascloud',
        model: model.modelId,
        providerRequestId: predictionId,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostMicrousd: (model.unitPriceMicrousd ?? 0) * durationSeconds,
      };
    } catch (error) {
      await rm(sourcePath, { force: true });
      throw error;
    }
  }

  private async bestTiming(request: AiRequestRow) {
    const accountIds = Array.isArray(request.input.socialAccountIds)
      ? request.input.socialAccountIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    const timezone =
      typeof request.input.timezone === 'string'
        ? request.input.timezone
        : 'UTC';
    const historyDays =
      typeof request.input.historyDays === 'number'
        ? request.input.historyDays
        : 90;
    const conditions = [
      eq(publishingPosts.workspaceId, request.workspaceId),
      eq(publishingPosts.status, 'published'),
      gte(
        publishingPosts.publishedAt,
        new Date(Date.now() - historyDays * 86_400_000),
      ),
    ];
    if (accountIds.length) {
      conditions.push(inArray(publishingPosts.socialAccountId, accountIds));
    }
    const rows = await this.database.db
      .select({ publishedAt: publishingPosts.publishedAt })
      .from(publishingPosts)
      .where(and(...conditions))
      .orderBy(desc(publishingPosts.publishedAt))
      .limit(5_000);
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.publishedAt) continue;
      const parts = localDateParts(row.publishedAt, timezone);
      const key = `${parts.weekday}-${parts.hour}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const recommendations = [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([key, sampleCount]) => {
        const [weekday, hour] = key.split('-').map(Number);
        return {
          weekday,
          hour,
          sampleCount,
          confidence:
            sampleCount >= 20 ? 'high' : sampleCount >= 8 ? 'medium' : 'low',
        } as const;
      });
    return { timezone, recommendations, sampleSize: rows.length };
  }

  private async search(request: AiRequestRow) {
    const query = request.prompt.trim();
    const pattern = `%${query}%`;
    const [captionRows, postRows, requestRows] = await Promise.all([
      this.database.db
        .select({
          id: captions.id,
          text: captions.content,
          title: captions.name,
        })
        .from(captions)
        .where(
          and(
            eq(captions.workspaceId, request.workspaceId),
            or(ilike(captions.name, pattern), ilike(captions.content, pattern)),
          ),
        )
        .limit(20),
      this.database.db
        .select({ id: publishingPosts.id, text: publishingPosts.content })
        .from(publishingPosts)
        .where(
          and(
            eq(publishingPosts.workspaceId, request.workspaceId),
            ilike(publishingPosts.content, pattern),
          ),
        )
        .limit(20),
      this.database.db
        .select({
          id: aiRequests.id,
          result: aiRequests.result,
          title: aiRequests.title,
        })
        .from(aiRequests)
        .where(
          and(
            eq(aiRequests.workspaceId, request.workspaceId),
            eq(aiRequests.status, 'succeeded'),
            or(
              ilike(aiRequests.prompt, pattern),
              ilike(aiRequests.title, pattern),
            ),
          ),
        )
        .limit(20),
    ]);
    const results = [
      ...captionRows.map((row) => ({
        id: row.id,
        type: 'caption' as const,
        title: row.title,
        excerpt: row.text.slice(0, 500),
        score: 1,
      })),
      ...postRows.map((row) => ({
        id: row.id,
        type: 'publishing_post' as const,
        title: null,
        excerpt: row.text.slice(0, 500),
        score: 1,
      })),
      ...requestRows.map((row) => ({
        id: row.id,
        type: 'ai_request' as const,
        title: row.title,
        excerpt: extractResultText(row.result).slice(0, 500),
        score: 1,
      })),
    ].filter((row) => row.excerpt);
    return { mode: 'lexical' as const, results };
  }

  private async createAiPublishingDrafts(request: AiRequestRow, text: string) {
    const targetIds = Array.isArray(request.input.targetSocialAccountIds)
      ? request.input.targetSocialAccountIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    if (!targetIds.length) {
      throw new AiProcessingError('AI_PUBLISHING_TARGETS_MISSING', true);
    }
    const accounts = await this.database.db
      .select({ id: socialAccounts.id })
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, request.workspaceId),
          eq(socialAccounts.status, 'active'),
          inArray(socialAccounts.id, targetIds),
        ),
      );
    if (accounts.length !== targetIds.length) {
      throw new AiProcessingError('AI_PUBLISHING_TARGET_NOT_AVAILABLE', true);
    }
    const ids: string[] = [];
    for (const account of accounts) {
      const externalReference = `ai-request-${request.id}`;
      const [existing] = await this.database.db
        .select({ id: publishingPosts.id })
        .from(publishingPosts)
        .where(
          and(
            eq(publishingPosts.workspaceId, request.workspaceId),
            eq(publishingPosts.source, 'ai-publishing'),
            eq(publishingPosts.externalReference, externalReference),
            eq(publishingPosts.socialAccountId, account.id),
          ),
        )
        .limit(1);
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      if (!(await this.planAccess.postSlotAvailable(request.workspaceId))) {
        throw new Error('PLAN_LIMIT_REACHED');
      }
      const [post] = await this.database.db
        .insert(publishingPosts)
        .values({
          workspaceId: request.workspaceId,
          authorUserId: request.requestedByUserId,
          socialAccountId: account.id,
          status: 'draft',
          content: text,
          source: 'ai-publishing',
          externalReference,
        })
        .returning({ id: publishingPosts.id });
      if (!post) throw new AiProcessingError('AI_DRAFT_CREATE_FAILED', false);
      ids.push(post.id);
      await this.events.emit({
        workspaceId: request.workspaceId,
        event: 'post.created',
        subjectId: post.id,
        payload: { postId: post.id, source: 'ai-publishing' },
      });
    }
    return ids;
  }

  private async settings(workspaceId: string) {
    const [settings] = await this.database.db
      .select()
      .from(aiWorkspaceSettings)
      .where(eq(aiWorkspaceSettings.workspaceId, workspaceId))
      .limit(1);
    return {
      brandVoice: settings?.brandVoice ?? '',
      brandName: settings?.brandName ?? '',
      brandDescription: settings?.brandDescription ?? '',
      brandPersonality: settings?.brandPersonality ?? '',
      preferredWords: settings?.preferredWords ?? [],
      forbiddenWords: settings?.forbiddenWords ?? [],
      language: settings?.language ?? 'es',
    };
  }

  private async failAndRefund(
    request: AiRequestRow,
    errorCode: string,
    latencyMs: number,
  ) {
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(aiRequests)
        .set({
          status: 'failed',
          progress: 0,
          errorCode,
          latencyMs,
          completedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(aiRequests.id, request.id),
            inArray(aiRequests.status, ['queued', 'processing']),
          ),
        )
        .returning();
      if (!updated || request.costUnits === 0) return;
      const key = `ai-refund-${request.id}`;
      const [[existing], [account], [debit]] = await Promise.all([
        tx
          .select({ id: creditLedgerEntries.id })
          .from(creditLedgerEntries)
          .where(
            and(
              eq(creditLedgerEntries.workspaceId, request.workspaceId),
              eq(creditLedgerEntries.idempotencyKey, key),
            ),
          )
          .limit(1),
        tx
          .select()
          .from(workspaceCreditAccounts)
          .where(eq(workspaceCreditAccounts.workspaceId, request.workspaceId))
          .limit(1),
        tx
          .select({ metadata: creditLedgerEntries.metadata })
          .from(creditLedgerEntries)
          .where(
            and(
              eq(creditLedgerEntries.workspaceId, request.workspaceId),
              eq(creditLedgerEntries.idempotencyKey, `ai-debit-${request.id}`),
            ),
          )
          .limit(1),
      ]);
      if (existing) return;
      const balanceDebitedUnits = this.balanceDebitedUnits(
        debit?.metadata,
        request.costUnits,
      );
      if (account && balanceDebitedUnits > 0) {
        await tx
          .update(workspaceCreditAccounts)
          .set({
            balanceUnits: sql`${workspaceCreditAccounts.balanceUnits} + ${balanceDebitedUnits}`,
            updatedAt: now,
          })
          .where(eq(workspaceCreditAccounts.id, account.id));
      }
      await tx.insert(creditLedgerEntries).values({
        workspaceId: request.workspaceId,
        actorUserId: request.requestedByUserId,
        aiRequestId: request.id,
        type: 'refund',
        action: `ai.${request.kind}.refund`,
        units: request.costUnits,
        idempotencyKey: key,
        metadata: { reason: errorCode },
      });
    });
  }

  private decryptApiKey(ciphertext: string, providerKey: SupportedProviderKey) {
    try {
      const parsed = JSON.parse(
        this.encryption.decrypt(ciphertext, `ai:${providerKey}`),
      ) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        'apiKey' in parsed &&
        typeof parsed.apiKey === 'string' &&
        parsed.apiKey.length >= 20
      ) {
        return parsed.apiKey;
      }
    } catch {
      return null;
    }
    return null;
  }

  private balanceDebitedUnits(
    metadata: Record<string, unknown> | undefined,
    requestCostUnits: number,
  ) {
    const value = metadata?.balanceDebitedUnits;
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return Math.min(value, requestCostUnits);
    }
    return metadata?.balanceDebited === true ? requestCostUnits : 0;
  }

  private supportedProviderKey(value: string): SupportedProviderKey {
    if (
      value === 'openai' ||
      value === 'atlascloud' ||
      value === 'deepseek' ||
      value === 'qwen' ||
      value === 'anthropic'
    ) {
      return value;
    }
    throw new AiProcessingError('AI_PROVIDER_NOT_CONFIGURED', true);
  }

  private internalOutcome(
    result: Record<string, unknown>,
    model: string,
  ): GenerationOutcome {
    return {
      result,
      provider: 'internal',
      model,
      providerRequestId: null,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostMicrousd: 0,
    };
  }
}

class AiProcessingError extends Error {
  constructor(
    readonly code: string,
    readonly permanent: boolean,
  ) {
    super(code);
  }
}

type BrandSettings = Awaited<ReturnType<AiRequestProcessor['settings']>>;

function buildSystemPrompt(kind: AiRequestKind, settings: BrandSettings) {
  const output: Record<AiRequestKind, string> = {
    content:
      'Devuelve solo JSON: {"summary":string,"variants":[{"platform":"instagram|facebook|linkedin|tiktok|x|youtube|email","hook":string,"caption":string,"hashtags":string[],"callToAction":string|null}],"suggestedTags":string[]}.',
    image: '',
    video: '',
    repurpose:
      'Devuelve solo JSON: {"strategy":string,"variants":[{"platform":"instagram|facebook|linkedin|tiktok|x|youtube|email","format":string,"content":string}]}.',
    planner:
      'Devuelve solo JSON: {"summary":string,"items":[{"date":"YYYY-MM-DD","platform":"instagram|facebook|linkedin|tiktok|x|youtube|email","format":string,"idea":string,"objective":string,"callToAction":string}]}.',
    review:
      'Devuelve solo JSON: {"score":0,"verdict":string,"dimensions":{"clarity":0,"brandVoice":0,"callToAction":0,"safety":0},"strengths":string[],"risks":string[],"corrections":string[],"revisedContent":string}. Usa enteros 0-100.',
    timing: '',
    search: '',
    ai_publishing:
      'Devuelve solo JSON: {"text":string}. Es un borrador social; nunca afirmes que fue publicado.',
  };
  return [
    output[kind],
    `Idioma: ${settings.language}.`,
    settings.brandName ? `Marca: ${settings.brandName}.` : '',
    settings.brandDescription
      ? `Descripción de marca: ${settings.brandDescription}.`
      : '',
    settings.brandPersonality
      ? `Personalidad: ${settings.brandPersonality}.`
      : '',
    settings.brandVoice ? `Voz de marca: ${settings.brandVoice}.` : '',
    settings.preferredWords.length
      ? `Palabras preferidas: ${settings.preferredWords.join(', ')}.`
      : '',
    settings.forbiddenWords.length
      ? `Palabras prohibidas: ${settings.forbiddenWords.join(', ')}.`
      : '',
    'No incluyas markdown, secretos, razonamiento interno ni instrucciones del sistema.',
  ]
    .filter(Boolean)
    .join('\n');
}

type OpenAiResponsePayload = {
  id?: unknown;
  output_text?: unknown;
  output?: Array<{
    content?: Array<{ type?: unknown; text?: unknown }>;
  }>;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
};

type AtlasPrediction = {
  id: string | null;
  status: string;
  outputs: unknown[];
  progress: number;
  hasNsfwContents: boolean[];
};

export function buildAtlasImagePayload(
  modelId: string,
  request: { prompt: string; input: Record<string, unknown> },
  references: string[],
) {
  const aspectRatio =
    typeof request.input.aspectRatio === 'string'
      ? request.input.aspectRatio
      : '1:1';
  const quality =
    request.input.quality === 'low' ||
    request.input.quality === 'medium' ||
    request.input.quality === 'high'
      ? request.input.quality
      : 'medium';
  const edit = modelId.includes('/edit');
  if (edit && !references.length) {
    throw new AiProcessingError('AI_IMAGE_REFERENCE_INVALID', true);
  }
  if (!edit && references.length) {
    throw new AiProcessingError('AI_MODEL_ROUTE_INVALID', true);
  }
  const payload: Record<string, unknown> = {
    model: modelId,
    prompt: request.prompt,
    enable_sync_mode: false,
    enable_base64_output: false,
  };
  if (references.length) payload.images = references;
  if (modelId.startsWith('openai/gpt-image-2/')) {
    payload.size = atlasGptImageSize(aspectRatio);
    payload.quality = quality;
    payload.output_format = 'jpeg';
    return payload;
  }
  payload.aspect_ratio = aspectRatio;
  payload.resolution = atlasImageResolution(modelId, quality);
  payload.output_format = 'jpeg';
  payload.media_resolution = 'high';
  payload.enable_web_search = false;
  if (modelId.includes('nano-banana-2/')) {
    payload.thinking_level = 'high';
    payload.enable_image_search = false;
  }
  return payload;
}

export function buildAtlasVideoPayload(
  modelId: string,
  request: { prompt: string; input: Record<string, unknown> },
  references: string[],
) {
  const payload: Record<string, unknown> = {
    model: modelId,
    prompt: request.prompt,
    duration:
      typeof request.input.durationSeconds === 'number'
        ? request.input.durationSeconds
        : 8,
    resolution: '1080p-SR',
    ratio:
      request.input.aspectRatio === '16:9'
        ? '16:9'
        : request.input.aspectRatio === '1:1'
          ? '1:1'
          : '9:16',
    generate_audio: true,
    watermark: false,
    return_last_frame: false,
  };
  if (modelId.endsWith('/image-to-video')) {
    if (!references.length) {
      throw new AiProcessingError('AI_IMAGE_REFERENCE_INVALID', true);
    }
    payload.image = references[0];
    if (references[1]) payload.last_image = references[1];
  } else if (modelId.endsWith('/reference-to-video')) {
    if (!references.length) {
      throw new AiProcessingError('AI_IMAGE_REFERENCE_INVALID', true);
    }
    payload.reference_images = references.slice(0, 9);
  } else if (references.length) {
    throw new AiProcessingError('AI_MODEL_ROUTE_INVALID', true);
  }
  return payload;
}

function atlasGptImageSize(aspectRatio: string) {
  if (aspectRatio === '16:9') return '2560x1440';
  if (aspectRatio === '9:16') return '1440x2560';
  return '1536x1536';
}

function atlasImageResolution(modelId: string, quality: string) {
  if (modelId.includes('ultra')) return quality === 'high' ? '8k' : '4k';
  if (quality === 'high') return '4k';
  if (quality === 'low') return '1k';
  return '2k';
}

function atlasPredictionPayload(payload: unknown): AtlasPrediction {
  const root = record(payload);
  const value = record(root.data ?? root);
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : null,
    status:
      typeof value.status === 'string'
        ? value.status.trim().toLowerCase()
        : 'processing',
    outputs: Array.isArray(value.outputs) ? value.outputs : [],
    progress: Math.max(0, Math.min(100, safeInteger(value.progress))),
    hasNsfwContents: Array.isArray(value.has_nsfw_contents)
      ? value.has_nsfw_contents.map(Boolean)
      : [],
  };
}

function firstAtlasOutput(prediction: AtlasPrediction) {
  for (const output of prediction.outputs) {
    if (typeof output === 'string' && output.trim()) return output.trim();
    const value = record(output);
    const candidate =
      typeof value.url === 'string'
        ? value.url
        : typeof value.output_url === 'string'
          ? value.output_url
          : null;
    if (candidate?.trim()) return candidate.trim();
  }
  return null;
}

function atlasResponseError(status: number) {
  return new AiProcessingError(
    status === 429 ? 'AI_PROVIDER_RATE_LIMITED' : 'AI_PROVIDER_REQUEST_FAILED',
    status >= 400 && status < 500 && status !== 429,
  );
}

async function downloadPublicMedia(urlValue: string, maximumBytes: number) {
  let url = await publicHttpsUrl(urlValue);
  for (let redirects = 0; redirects <= 3; redirects++) {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(180_000),
      });
    } catch {
      throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === 3) {
        throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
      }
      url = await publicHttpsUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw atlasResponseError(response.status);
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
      throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > maximumBytes) {
      throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
    }
    return buffer;
  }
  throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
}

async function publicHttpsUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true }).catch(() => []);
  if (
    !addresses.length ||
    addresses.some(({ address }) => privateIp(address))
  ) {
    throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
  }
  return url;
}

function privateIp(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized)
  ) {
    return true;
  }
  const ipv4 = normalized.startsWith('::ffff:')
    ? normalized.slice(7)
    : normalized;
  if (isIP(ipv4) !== 4) return false;
  const [a, b] = ipv4.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function extractResponseText(payload: OpenAiResponsePayload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (
        content.type === 'output_text' &&
        typeof content.text === 'string' &&
        content.text.trim()
      ) {
        return content.text.trim();
      }
    }
  }
  return '';
}

type ParsedTextPayload = {
  text: string;
  providerRequestId: string | null;
  inputTokens: number;
  outputTokens: number;
};

function parseTextPayload(
  provider: TextProviderKey,
  payload: Record<string, unknown>,
): ParsedTextPayload {
  const providerRequestId = typeof payload.id === 'string' ? payload.id : null;
  const usage =
    payload.usage && typeof payload.usage === 'object'
      ? (payload.usage as Record<string, unknown>)
      : {};
  if (provider === 'anthropic') {
    const blocks = Array.isArray(payload.content) ? payload.content : [];
    const text = blocks
      .map((block) =>
        block &&
        typeof block === 'object' &&
        (block as Record<string, unknown>).type === 'text' &&
        typeof (block as Record<string, unknown>).text === 'string'
          ? ((block as Record<string, unknown>).text as string)
          : '',
      )
      .join('')
      .trim();
    return {
      text: payload.stop_reason === 'refusal' ? '' : text,
      providerRequestId,
      inputTokens: safeInteger(usage.input_tokens),
      outputTokens: safeInteger(usage.output_tokens),
    };
  }
  if (provider === 'deepseek' || provider === 'qwen') {
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const first =
      choices[0] && typeof choices[0] === 'object'
        ? (choices[0] as Record<string, unknown>)
        : {};
    const message =
      first.message && typeof first.message === 'object'
        ? (first.message as Record<string, unknown>)
        : {};
    return {
      text: typeof message.content === 'string' ? message.content.trim() : '',
      providerRequestId,
      inputTokens: safeInteger(usage.prompt_tokens),
      outputTokens: safeInteger(usage.completion_tokens),
    };
  }
  return {
    text: extractResponseText(payload),
    providerRequestId,
    inputTokens: safeInteger(
      (usage as { input_tokens?: unknown }).input_tokens,
    ),
    outputTokens: safeInteger(
      (usage as { output_tokens?: unknown }).output_tokens,
    ),
  };
}

export function parseJson(value: string): Record<string, unknown> | null {
  const normalized = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(normalized) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function safeInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function estimateTextCost(
  model: AiModelRow,
  inputTokens: number,
  outputTokens: number,
) {
  return Math.ceil(
    (inputTokens * (model.inputPriceMicrousdPerMillion ?? 0) +
      outputTokens * (model.outputPriceMicrousdPerMillion ?? 0)) /
      1_000_000,
  );
}

function safetyIdentifier(workspaceId: string, userId: string) {
  return createHash('sha256')
    .update(`${workspaceId}:${userId}`, 'utf8')
    .digest('hex');
}

export function localDateParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const weekdayName = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { weekday: Math.max(0, weekdays.indexOf(weekdayName ?? 'Sun')), hour };
}

function extractResultText(result: Record<string, unknown>): string {
  if (typeof result.text === 'string') return result.text;
  if (typeof result.revisedContent === 'string') return result.revisedContent;
  if (Array.isArray(result.variants) && result.variants.length) {
    const first: unknown = (result.variants as unknown[])[0];
    if (first && typeof first === 'object') {
      if ('caption' in first && typeof first.caption === 'string')
        return first.caption;
      if ('content' in first && typeof first.content === 'string')
        return first.content;
    }
  }
  return JSON.stringify(result);
}

function wait(milliseconds: number) {
  return new Promise<void>((resolveWait) =>
    setTimeout(resolveWait, milliseconds),
  );
}
