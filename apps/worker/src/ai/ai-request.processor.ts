import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import {
  AI_REQUEST_JOB,
  AI_REQUEST_QUEUE,
  type AiRequestJobData,
} from './ai.constants';

type AiRequestRow = typeof aiRequests.$inferSelect;
type AiModelRow = typeof aiModels.$inferSelect;
type ProviderIntegrationRow = typeof providerIntegrations.$inferSelect;

type Execution = {
  provider: 'internal' | 'openai';
  apiKey?: string;
  primaryModel: AiModelRow | null;
  fallbackModel: AiModelRow | null;
  reasoningEffort: AiReasoningEffort;
};

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
      provider: 'openai',
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
    const modelIds = [route.primaryModelId, route.fallbackModelId].filter(
      (value): value is string => Boolean(value),
    );
    const [models, provider]: [AiModelRow[], ProviderIntegrationRow | null] =
      await Promise.all([
        modelIds.length
          ? this.database.db
              .select()
              .from(aiModels)
              .where(inArray(aiModels.id, modelIds))
          : Promise.resolve([]),
        this.openAiProvider(),
      ]);
    const primaryModel =
      models.find((model) => model.modelId === request.model) ??
      models.find((model) => model.id === route.primaryModelId) ??
      null;
    const fallbackModel =
      models.find((model) => model.id === route.fallbackModelId) ?? null;
    if (
      !provider?.enabled ||
      provider.readiness !== 'ready' ||
      !provider.configurationCiphertext ||
      !primaryModel?.enabled ||
      primaryModel.deprecated
    ) {
      throw new AiProcessingError('AI_PROVIDER_NOT_CONFIGURED', true);
    }
    const apiKey = this.decryptApiKey(provider.configurationCiphertext);
    if (!apiKey) {
      throw new AiProcessingError('AI_PROVIDER_NOT_CONFIGURED', true);
    }
    return {
      provider: 'openai',
      apiKey,
      primaryModel,
      fallbackModel:
        fallbackModel?.enabled && !fallbackModel.deprecated
          ? fallbackModel
          : null,
      reasoningEffort: route.reasoningEffort,
    };
  }

  private async openAiProvider(): Promise<ProviderIntegrationRow | null> {
    const [provider] = await this.database.db
      .select()
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, 'openai'))
      .limit(1);
    return provider ?? null;
  }

  private async generateText(
    request: AiRequestRow,
    execution: Execution,
    instructions: string,
  ): Promise<OpenAiTextOutcome> {
    if (!execution.apiKey || !execution.primaryModel) {
      throw new AiProcessingError('AI_PROVIDER_NOT_CONFIGURED', true);
    }
    const models = [execution.primaryModel, execution.fallbackModel].filter(
      (model): model is AiModelRow => Boolean(model),
    );
    let lastError: AiProcessingError | null = null;
    for (const model of models) {
      let response: Response;
      try {
        response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${execution.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: model.modelId,
            instructions,
            input: `${request.prompt}\n\nContexto estructurado:\n${JSON.stringify(request.input)}`,
            reasoning: { effort: execution.reasoningEffort },
            text: { verbosity: 'low' },
            max_output_tokens: 8_000,
            store: false,
            safety_identifier: safetyIdentifier(
              request.workspaceId,
              request.requestedByUserId,
            ),
          }),
          signal: AbortSignal.timeout(120_000),
        });
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
      const payload = (await response.json()) as OpenAiResponsePayload;
      const text = extractResponseText(payload);
      if (!text) {
        throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
      }
      const inputTokens = safeInteger(payload.usage?.input_tokens);
      const outputTokens = safeInteger(payload.usage?.output_tokens);
      return {
        text,
        model,
        providerRequestId: typeof payload.id === 'string' ? payload.id : null,
        inputTokens,
        outputTokens,
        estimatedCostMicrousd: estimateTextCost(
          model,
          inputTokens,
          outputTokens,
        ),
      };
    }
    throw (
      lastError ?? new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false)
    );
  }

  private async generateImage(
    request: AiRequestRow,
    execution: Execution,
  ): Promise<GenerationOutcome> {
    if (!execution.apiKey || !execution.primaryModel) {
      throw new AiProcessingError('AI_IMAGE_PROVIDER_NOT_CONFIGURED', true);
    }
    const aspectRatio =
      typeof request.input.aspectRatio === 'string'
        ? request.input.aspectRatio
        : '1:1';
    const size =
      aspectRatio === '9:16'
        ? '1024x1536'
        : aspectRatio === '16:9'
          ? '1536x1024'
          : '1024x1024';
    const referenceIds = Array.isArray(request.input.referenceAssetIds)
      ? request.input.referenceAssetIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    let response: Response;
    if (referenceIds.length) {
      const assets = await this.database.db
        .select()
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.workspaceId, request.workspaceId),
            eq(fileAssets.status, 'ready'),
            inArray(fileAssets.id, referenceIds),
          ),
        );
      if (
        assets.length !== referenceIds.length ||
        assets.some((asset) => !asset.mimeType.startsWith('image/'))
      ) {
        throw new AiProcessingError('AI_IMAGE_REFERENCE_INVALID', true);
      }
      const form = new FormData();
      form.set('model', execution.primaryModel.modelId);
      form.set('prompt', request.prompt);
      form.set(
        'quality',
        typeof request.input.quality === 'string'
          ? request.input.quality
          : 'medium',
      );
      form.set('size', size);
      for (const asset of assets) {
        const path = resolve(this.storageRoot, asset.storageKey);
        const pathFromRoot = relative(this.storageRoot, path);
        if (pathFromRoot.startsWith('..') || pathFromRoot.includes('\0')) {
          throw new AiProcessingError('AI_IMAGE_REFERENCE_INVALID', true);
        }
        const source = await readFile(path);
        form.append(
          'image[]',
          new Blob([source], { type: asset.mimeType }),
          asset.name,
        );
      }
      response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { authorization: `Bearer ${execution.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(180_000),
      });
    } else {
      response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${execution.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: execution.primaryModel.modelId,
          prompt: request.prompt,
          quality:
            typeof request.input.quality === 'string'
              ? request.input.quality
              : 'medium',
          size,
        }),
        signal: AbortSignal.timeout(180_000),
      });
    }
    if (!response.ok) {
      throw new AiProcessingError(
        response.status === 429
          ? 'AI_PROVIDER_RATE_LIMITED'
          : 'AI_PROVIDER_REQUEST_FAILED',
        response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429,
      );
    }
    const payload = (await response.json()) as {
      id?: unknown;
      data?: Array<{ b64_json?: unknown; revised_prompt?: unknown }>;
      usage?: { input_tokens?: unknown; output_tokens?: unknown };
    };
    const encoded = payload.data?.[0]?.b64_json;
    if (typeof encoded !== 'string') {
      throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
    }
    const buffer = Buffer.from(encoded, 'base64');
    if (!buffer.length || buffer.length > 25 * 1024 * 1024) {
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
    const storageKey = `${request.workspaceId}/${id}`;
    const thumbnailKey = `${storageKey}.thumb.webp`;
    const sourcePath = resolve(this.storageRoot, storageKey);
    const thumbnailPath = resolve(this.storageRoot, thumbnailKey);
    try {
      await mkdir(resolve(sourcePath, '..'), { recursive: true });
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
      const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
      const [asset] = await this.database.db
        .insert(fileAssets)
        .values({
          id,
          workspaceId: request.workspaceId,
          createdByUserId: request.requestedByUserId,
          storageKey,
          name: `AI ${request.prompt.slice(0, 80).trim()}.${extension}`,
          mimeType: `image/${metadata.format}`,
          extension,
          sizeBytes: buffer.length,
          width: metadata.width ?? null,
          height: metadata.height ?? null,
          thumbnailKey,
          thumbnailStatus: 'ready',
          status: 'ready',
          metadata: { source: 'ai', aiRequestId: request.id },
        })
        .returning({ id: fileAssets.id });
      if (!asset) throw new AiProcessingError('AI_IMAGE_STORE_FAILED', false);
      const inputTokens = safeInteger(payload.usage?.input_tokens);
      const outputTokens = safeInteger(payload.usage?.output_tokens);
      return {
        result: {
          assets: [
            {
              fileAssetId: asset.id,
              width: metadata.width ?? null,
              height: metadata.height ?? null,
            },
          ],
          revisedPrompt:
            typeof payload.data?.[0]?.revised_prompt === 'string'
              ? payload.data[0].revised_prompt
              : null,
        },
        provider: 'openai',
        model: execution.primaryModel.modelId,
        providerRequestId: typeof payload.id === 'string' ? payload.id : null,
        inputTokens,
        outputTokens,
        estimatedCostMicrousd: estimateTextCost(
          execution.primaryModel,
          inputTokens,
          outputTokens,
        ),
      };
    } catch (error) {
      await Promise.all([
        rm(sourcePath, { force: true }),
        rm(thumbnailPath, { force: true }),
      ]);
      throw error;
    }
  }

  private async generateVideo(
    request: AiRequestRow,
    execution: Execution,
  ): Promise<GenerationOutcome> {
    if (!execution.apiKey || !execution.primaryModel) {
      throw new AiProcessingError('AI_VIDEO_PROVIDER_NOT_CONFIGURED', true);
    }
    const seconds =
      typeof request.input.durationSeconds === 'number'
        ? request.input.durationSeconds
        : 8;
    const size = request.input.aspectRatio === '16:9' ? '1280x720' : '720x1280';
    const createdResponse = await fetch('https://api.openai.com/v1/videos', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${execution.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: execution.primaryModel.modelId,
        prompt: request.prompt,
        seconds,
        size,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!createdResponse.ok) {
      throw new AiProcessingError(
        createdResponse.status === 429
          ? 'AI_PROVIDER_RATE_LIMITED'
          : 'AI_PROVIDER_REQUEST_FAILED',
        createdResponse.status >= 400 &&
          createdResponse.status < 500 &&
          createdResponse.status !== 429,
      );
    }
    let video = (await createdResponse.json()) as VideoJobPayload;
    if (typeof video.id !== 'string') {
      throw new AiProcessingError('AI_PROVIDER_RESPONSE_INVALID', true);
    }
    let videoId = video.id;
    const deadline = Date.now() + 8 * 60_000;
    while (video.status !== 'completed') {
      if (video.status === 'failed' || video.status === 'cancelled') {
        throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', true);
      }
      if (Date.now() >= deadline) {
        throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
      }
      await wait(5_000);
      const statusResponse = await fetch(
        `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}`,
        {
          headers: { authorization: `Bearer ${execution.apiKey}` },
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!statusResponse.ok) {
        throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
      }
      video = (await statusResponse.json()) as VideoJobPayload;
      if (typeof video.id === 'string') videoId = video.id;
      const progress = Math.max(10, Math.min(95, safeInteger(video.progress)));
      await this.database.db
        .update(aiRequests)
        .set({ progress, providerRequestId: videoId, updatedAt: new Date() })
        .where(
          and(
            eq(aiRequests.id, request.id),
            eq(aiRequests.status, 'processing'),
          ),
        );
    }
    const contentResponse = await fetch(
      `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}/content`,
      {
        headers: { authorization: `Bearer ${execution.apiKey}` },
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!contentResponse.ok) {
      throw new AiProcessingError('AI_PROVIDER_REQUEST_FAILED', false);
    }
    const buffer = Buffer.from(await contentResponse.arrayBuffer());
    if (
      buffer.length < 16 ||
      buffer.length > 250 * 1024 * 1024 ||
      buffer.subarray(4, 8).toString('ascii') !== 'ftyp'
    ) {
      throw new AiProcessingError('AI_VIDEO_BINARY_INVALID', true);
    }
    const id = randomUUID();
    const storageKey = `${request.workspaceId}/${id}.mp4`;
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
          width: size === '1280x720' ? 1280 : 720,
          height: size === '1280x720' ? 720 : 1280,
          thumbnailStatus: 'not_applicable',
          status: 'ready',
          metadata: {
            source: 'ai',
            aiRequestId: request.id,
            providerRequestId: videoId,
            durationSeconds: seconds,
          },
        })
        .returning({ id: fileAssets.id });
      if (!asset) throw new AiProcessingError('AI_VIDEO_STORE_FAILED', false);
      return {
        result: {
          fileAssetId: asset.id,
          durationSeconds: seconds,
          width: size === '1280x720' ? 1280 : 720,
          height: size === '1280x720' ? 720 : 1280,
        },
        provider: 'openai',
        model: execution.primaryModel.modelId,
        providerRequestId: videoId,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostMicrousd:
          (execution.primaryModel.unitPriceMicrousd ?? 0) * seconds,
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
      sql`${publishingPosts.publishedAt} >= ${new Date(Date.now() - historyDays * 86_400_000)}`,
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
      if (account && debit?.metadata.balanceDebited === true) {
        await tx
          .update(workspaceCreditAccounts)
          .set({
            balanceUnits: sql`${workspaceCreditAccounts.balanceUnits} + ${request.costUnits}`,
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

  private decryptApiKey(ciphertext: string) {
    try {
      const parsed = JSON.parse(
        this.encryption.decrypt(ciphertext, 'ai:openai'),
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

type VideoJobPayload = {
  id?: unknown;
  status?: unknown;
  progress?: unknown;
};

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
