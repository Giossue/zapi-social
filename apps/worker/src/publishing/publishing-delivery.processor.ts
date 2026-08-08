import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  fileAssets,
  providerIntegrations,
  publishingPostAttempts,
  publishingPostMedia,
  publishingPosts,
  socialAccountCredentials,
  socialAccounts,
} from '@workspace/database';
import { and, asc, eq, or, sql } from '@workspace/database/query';
import type { Job, Queue } from 'bullmq';
import { WorkerAuditService } from '../audit/worker-audit.service';
import { AutomationWebhookEventsService } from '../automation/automation-webhook-events.service';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import {
  PUBLISHING_DELIVERY_JOB,
  PUBLISHING_DELIVERY_QUEUE,
  PUBLISHING_DISPATCH_JOB,
  type PublishingDeliveryJobData,
  type PublishingDispatchJobData,
} from './publishing.constants';
import {
  PublishingMediaPreparationService,
  type PreparedPublishingAsset,
} from './publishing-media-preparation.service';

type Account = typeof socialAccounts.$inferSelect;
type Asset = typeof fileAssets.$inferSelect;
type Post = typeof publishingPosts.$inferSelect;
type Attempt = typeof publishingPostAttempts.$inferSelect;
type ProviderResult = {
  providerRequestId: string | null;
  response: Record<string, unknown>;
};
const providerOutcomeUnknownCode = 'PUBLISHING_PROVIDER_OUTCOME_UNKNOWN';
const processingAttemptLeaseMs = 45 * 60_000;

@Injectable()
@Processor(PUBLISHING_DELIVERY_QUEUE, { concurrency: 3 })
export class PublishingDeliveryProcessor extends WorkerHost {
  private readonly apiPublicOrigin?: string;
  private readonly signingKey: string;
  private readonly storageRoot: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
    private readonly audit: WorkerAuditService,
    private readonly events: AutomationWebhookEventsService,
    private readonly mediaPreparation: PublishingMediaPreparationService,
    @InjectQueue(PUBLISHING_DELIVERY_QUEUE)
    private readonly queue: Queue<
      PublishingDeliveryJobData | PublishingDispatchJobData
    >,
    config: ConfigService,
  ) {
    super();
    this.apiPublicOrigin = config.get<string>('API_PUBLIC_ORIGIN');
    this.signingKey = config.getOrThrow<string>(
      'PROVIDER_INTEGRATIONS_ENCRYPTION_KEY',
    );
    this.storageRoot = resolve(
      config.get<string>('FILES_STORAGE_PATH') ?? './.data/files',
    );
  }

  async process(
    job: Job<PublishingDeliveryJobData | PublishingDispatchJobData>,
  ) {
    if (job.name === PUBLISHING_DISPATCH_JOB) {
      await this.enqueueDue();
      return;
    }
    if (job.name !== PUBLISHING_DELIVERY_JOB) return;
    const data = job.data as PublishingDeliveryJobData;
    const context = await this.claim(job, data);
    if (!context) return;
    let result: ProviderResult;
    try {
      result = await this.publish(
        context.post,
        context.account,
        context.assets,
      );
    } catch (error) {
      const deliveryError =
        error instanceof PublishingDeliveryError
          ? error
          : new PublishingDeliveryError('PUBLISHING_PROVIDER_REQUEST_FAILED');
      const finalAttempt =
        deliveryError.permanent ||
        job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await this.finishFailed(
        context.post,
        context.attempt,
        deliveryError.code,
        finalAttempt,
        job,
      );
      if (!finalAttempt) throw error;
      return;
    }
    try {
      await this.finishSucceeded(context.post, context.attempt, result, job);
    } catch {
      await this.finishFailed(
        context.post,
        context.attempt,
        providerOutcomeUnknownCode,
        true,
        job,
      ).catch(() => undefined);
    }
  }

  async enqueueDue() {
    const now = new Date();
    await this.expireAmbiguousAttempts(now);
    const rows = await this.database.db
      .select({
        id: publishingPosts.id,
        workspaceId: publishingPosts.workspaceId,
        updatedAt: publishingPosts.updatedAt,
      })
      .from(publishingPosts)
      .where(
        or(
          eq(publishingPosts.status, 'processing'),
          and(
            eq(publishingPosts.status, 'scheduled'),
            sql`${publishingPosts.scheduledAt} <= ${now}`,
          ),
        ),
      )
      .limit(200);
    for (const row of rows) {
      await this.enqueue(row.id, row.workspaceId, row.updatedAt).catch(
        () => undefined,
      );
    }
  }

  private async enqueue(
    publishingPostId: string,
    workspaceId: string,
    version: Date,
  ) {
    await this.queue.add(
      PUBLISHING_DELIVERY_JOB,
      { publishingPostId, workspaceId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        jobId: `publishing-${publishingPostId}-${version.getTime()}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  private async claim(job: Job, data: PublishingDeliveryJobData) {
    const now = new Date();
    const claimed = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ post: publishingPosts, account: socialAccounts })
        .from(publishingPosts)
        .innerJoin(
          socialAccounts,
          eq(publishingPosts.socialAccountId, socialAccounts.id),
        )
        .where(
          and(
            eq(publishingPosts.id, data.publishingPostId),
            eq(publishingPosts.workspaceId, data.workspaceId),
          ),
        )
        .for('update')
        .limit(1);
      if (!row || !this.isDue(row.post, now)) return null;
      if (row.post.status === 'scheduled') {
        const [updated] = await tx
          .update(publishingPosts)
          .set({ status: 'processing', failureCode: null })
          .where(
            and(
              eq(publishingPosts.id, row.post.id),
              eq(publishingPosts.status, 'scheduled'),
            ),
          )
          .returning();
        if (!updated) return null;
        row.post = updated;
      }
      const jobId = String(job.id ?? `publishing-${row.post.id}`);
      const [existing] = await tx
        .select()
        .from(publishingPostAttempts)
        .where(eq(publishingPostAttempts.jobId, jobId))
        .limit(1);
      if (
        existing &&
        existing.status !== 'queued' &&
        existing.status !== 'failed'
      ) {
        return null;
      }
      if (existing) {
        const [attempt] = await tx
          .update(publishingPostAttempts)
          .set({ status: 'processing', startedAt: now, updatedAt: now })
          .where(eq(publishingPostAttempts.id, existing.id))
          .returning();
        return attempt ? { ...row, attempt } : null;
      }
      const [countRow] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(publishingPostAttempts)
        .where(eq(publishingPostAttempts.publishingPostId, row.post.id));
      const [attempt] = await tx
        .insert(publishingPostAttempts)
        .values({
          publishingPostId: row.post.id,
          workspaceId: row.post.workspaceId,
          attemptNumber: (countRow?.value ?? 0) + 1,
          status: 'processing',
          jobId,
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return attempt ? { ...row, attempt } : null;
    });
    if (!claimed) return null;
    const assets = await this.database.db
      .select({ asset: fileAssets })
      .from(publishingPostMedia)
      .innerJoin(fileAssets, eq(publishingPostMedia.fileAssetId, fileAssets.id))
      .where(eq(publishingPostMedia.publishingPostId, claimed.post.id))
      .orderBy(asc(publishingPostMedia.position));
    return { ...claimed, assets: assets.map(({ asset }) => asset) };
  }

  private async expireAmbiguousAttempts(now: Date) {
    const staleBefore = new Date(now.getTime() - processingAttemptLeaseMs);
    const rows = await this.database.db
      .select({
        attempt: publishingPostAttempts,
        post: publishingPosts,
      })
      .from(publishingPostAttempts)
      .innerJoin(
        publishingPosts,
        and(
          eq(publishingPostAttempts.publishingPostId, publishingPosts.id),
          eq(publishingPostAttempts.workspaceId, publishingPosts.workspaceId),
        ),
      )
      .where(
        and(
          eq(publishingPostAttempts.status, 'processing'),
          eq(publishingPosts.status, 'processing'),
          sql`${publishingPostAttempts.updatedAt} <= ${staleBefore}`,
        ),
      )
      .limit(200);

    for (const row of rows) {
      const expired = await this.database.db
        .transaction(async (tx) => {
          const [attempt] = await tx
            .update(publishingPostAttempts)
            .set({
              status: 'failed',
              errorCode: providerOutcomeUnknownCode,
              finishedAt: now,
              updatedAt: now,
            })
            .where(
              and(
                eq(publishingPostAttempts.id, row.attempt.id),
                eq(publishingPostAttempts.status, 'processing'),
                sql`${publishingPostAttempts.updatedAt} <= ${staleBefore}`,
              ),
            )
            .returning({ id: publishingPostAttempts.id });
          if (!attempt) return false;
          const [post] = await tx
            .update(publishingPosts)
            .set({
              status: 'failed',
              failureCode: providerOutcomeUnknownCode,
              updatedAt: now,
            })
            .where(
              and(
                eq(publishingPosts.id, row.post.id),
                eq(publishingPosts.workspaceId, row.post.workspaceId),
                eq(publishingPosts.status, 'processing'),
              ),
            )
            .returning({ id: publishingPosts.id });
          if (!post) throw new Error('PUBLISHING_STATE_CONFLICT');
          await this.events.emitInTransaction(tx, {
            workspaceId: row.post.workspaceId,
            event: 'post.failed',
            subjectId: row.post.id,
            occurrenceId: row.attempt.id,
            payload: {
              postId: row.post.id,
              errorCode: providerOutcomeUnknownCode,
            },
          });
          return true;
        })
        .catch(() => false);
      if (!expired) continue;
      await this.audit
        .write({
          workspaceId: row.post.workspaceId,
          actorUserId: row.post.authorUserId,
          event: 'publishing.post_delivered',
          severity: 'error',
          outcome: 'failed',
          queueName: PUBLISHING_DELIVERY_QUEUE,
          jobId: row.attempt.jobId,
          attempt: row.attempt.attemptNumber,
          errorCode: providerOutcomeUnknownCode,
          metadata: {
            publishingPostId: row.post.id,
            reconciliation: 'processing_attempt_expired',
          },
        })
        .catch(() => undefined);
    }
  }

  private isDue(post: Post, now: Date) {
    return (
      post.status === 'processing' ||
      (post.status === 'scheduled' &&
        post.scheduledAt !== null &&
        post.scheduledAt <= now)
    );
  }

  private async publish(post: Post, account: Account, assets: Asset[]) {
    if (
      assets.some(
        (asset) =>
          asset.workspaceId !== post.workspaceId || asset.status !== 'ready',
      )
    ) {
      throw new PublishingDeliveryError('PUBLISHING_MEDIA_NOT_AVAILABLE', true);
    }
    if (account.status !== 'active' || account.disconnectedAt) {
      throw new PublishingDeliveryError(
        'PUBLISHING_ACCOUNT_DISCONNECTED',
        true,
      );
    }
    const prepared = await this.mediaPreparation.prepare(post, account, assets);
    try {
      if (account.capabilityKey === 'facebook_page') {
        return await this.publishFacebook(post, account, prepared.assets);
      }
      if (account.capabilityKey === 'instagram_profile') {
        return await this.publishInstagram(post, account, prepared.assets);
      }
      if (account.capabilityKey === 'whatsapp_status') {
        return await this.publishWhatsAppStatus(post, account, prepared.assets);
      }
      throw new PublishingDeliveryError(
        'PUBLISHING_CAPABILITY_UNSUPPORTED',
        true,
      );
    } finally {
      await prepared.cleanup();
    }
  }

  private async publishFacebook(
    post: Post,
    account: Account,
    assets: PreparedPublishingAsset[],
  ) {
    const token = await this.metaToken(account);
    const externalId = this.requireExternalId(account);
    if (!assets.length) {
      return this.metaRequest(`${externalId}/feed`, {
        access_token: token,
        message: post.content,
      });
    }
    if (assets.length === 1) {
      const asset = assets[0];
      const endpoint = asset.mimeType.startsWith('video/')
        ? `${externalId}/videos`
        : `${externalId}/photos`;
      const form = await this.assetForm(asset, token);
      form.set(
        asset.mimeType.startsWith('video/') ? 'description' : 'message',
        post.content,
      );
      return this.metaMultipart(endpoint, form);
    }
    if (assets.some((asset) => !asset.mimeType.startsWith('image/'))) {
      throw new PublishingDeliveryError(
        'PUBLISHING_MEDIA_COMBINATION_UNSUPPORTED',
        true,
      );
    }
    const uploaded: string[] = [];
    for (const asset of assets) {
      const form = await this.assetForm(asset, token);
      form.set('published', 'false');
      const result = await this.metaMultipart(`${externalId}/photos`, form);
      if (!result.providerRequestId) {
        throw new PublishingDeliveryError(
          'PUBLISHING_PROVIDER_RESPONSE_INVALID',
        );
      }
      uploaded.push(result.providerRequestId);
    }
    const fields: Record<string, string> = {
      access_token: token,
      message: post.content,
    };
    uploaded.forEach((id, index) => {
      fields[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
    });
    return this.metaRequest(`${externalId}/feed`, fields);
  }

  private async publishInstagram(
    post: Post,
    account: Account,
    assets: PreparedPublishingAsset[],
  ) {
    if (assets.length !== 1) {
      throw new PublishingDeliveryError(
        'PUBLISHING_INSTAGRAM_MEDIA_REQUIRED',
        true,
      );
    }
    const token = await this.metaToken(account);
    const externalId = this.requireExternalId(account);
    const asset = assets[0];
    const mediaUrl = this.publicMediaUrl(asset.id, asset.publicVariant);
    const createFields: Record<string, string> = {
      access_token: token,
      caption: post.content,
      [asset.mimeType.startsWith('video/') ? 'video_url' : 'image_url']:
        mediaUrl,
    };
    if (asset.mimeType.startsWith('video/')) createFields.media_type = 'REELS';
    const container = await this.metaRequest(
      `${externalId}/media`,
      createFields,
    );
    if (!container.providerRequestId) {
      throw new PublishingDeliveryError('PUBLISHING_PROVIDER_RESPONSE_INVALID');
    }
    await this.waitForInstagramContainer(container.providerRequestId, token);
    return this.metaRequest(`${externalId}/media_publish`, {
      access_token: token,
      creation_id: container.providerRequestId,
    });
  }

  private async publishWhatsAppStatus(
    post: Post,
    account: Account,
    assets: PreparedPublishingAsset[],
  ) {
    if (assets.length !== 1) {
      throw new PublishingDeliveryError(
        'PUBLISHING_WHATSAPP_MEDIA_REQUIRED',
        true,
      );
    }
    const [integration] = await this.database.db
      .select()
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, 'whatsapp-status'))
      .limit(1);
    if (
      !integration?.enabled ||
      integration.readiness !== 'ready' ||
      !integration.configurationCiphertext
    ) {
      throw new PublishingDeliveryError(
        'PUBLISHING_WHATSAPP_NOT_CONFIGURED',
        true,
      );
    }
    const configuration = parseWhatsAppConfiguration(
      this.encryption.decrypt(
        integration.configurationCiphertext,
        'whatsapp-status',
      ),
    );
    const deviceId = stringMetadata(account.metadata, 'deviceId');
    if (!configuration || !deviceId) {
      throw new PublishingDeliveryError(
        'PUBLISHING_WHATSAPP_NOT_CONFIGURED',
        true,
      );
    }
    const asset = assets[0];
    const form = new FormData();
    form.set('phone', 'status@broadcast');
    form.set('caption', post.content);
    form.set('compress', 'false');
    form.set(
      asset.mimeType.startsWith('video/') ? 'video' : 'image',
      await this.assetBlob(asset),
      asset.name,
    );
    const endpoint = asset.mimeType.startsWith('video/')
      ? '/send/video'
      : '/send/image';
    const response = await this.providerPost(
      `${configuration.baseUrl}${endpoint}`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${configuration.basicAuthUsername}:${configuration.basicAuthPassword}`).toString('base64')}`,
          'x-device-id': deviceId,
        },
        body: form,
        signal: AbortSignal.timeout(180_000),
      },
    );
    const payload = await responseJson(response);
    if (!response.ok || !isProviderSuccess(payload)) {
      throw this.providerHttpError(
        response.status,
        'PUBLISHING_WHATSAPP_REJECTED',
      );
    }
    const providerRequestId = firstString(payload, [
      'id',
      'message_id',
      'messageId',
    ]);
    if (!providerRequestId) {
      throw new PublishingDeliveryError(providerOutcomeUnknownCode, true);
    }
    return {
      providerRequestId,
      response: sanitizeProviderResponse(payload, providerRequestId),
    };
  }

  private async metaToken(account: Account) {
    const [credential] = await this.database.db
      .select()
      .from(socialAccountCredentials)
      .where(eq(socialAccountCredentials.socialAccountId, account.id))
      .limit(1);
    if (!credential?.accessTokenCiphertext) {
      throw new PublishingDeliveryError('PUBLISHING_CREDENTIAL_MISSING', true);
    }
    try {
      return this.encryption.decrypt(
        credential.accessTokenCiphertext,
        `meta:account:${account.id}`,
      );
    } catch {
      throw new PublishingDeliveryError('PUBLISHING_CREDENTIAL_INVALID', true);
    }
  }

  private requireExternalId(account: Account) {
    if (!account.externalId) {
      throw new PublishingDeliveryError('PUBLISHING_EXTERNAL_ID_MISSING', true);
    }
    return encodeURIComponent(account.externalId);
  }

  private async metaRequest(path: string, fields: Record<string, string>) {
    const response = await this.providerPost(
      `https://graph.facebook.com/v22.0/${path}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields),
        signal: AbortSignal.timeout(60_000),
      },
    );
    return this.parseMetaResponse(response);
  }

  private async metaMultipart(path: string, form: FormData) {
    const response = await this.providerPost(
      `https://graph.facebook.com/v22.0/${path}`,
      {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(180_000),
      },
    );
    return this.parseMetaResponse(response);
  }

  private async providerPost(input: string, init: RequestInit) {
    try {
      return await fetch(input, init);
    } catch {
      throw new PublishingDeliveryError(providerOutcomeUnknownCode, true);
    }
  }

  private async parseMetaResponse(response: Response): Promise<ProviderResult> {
    const payload = await responseJson(response);
    if (!response.ok || isRecord(payload.error)) {
      throw this.providerHttpError(response.status, 'PUBLISHING_META_REJECTED');
    }
    const providerRequestId = firstString(payload, ['id', 'post_id']);
    if (!providerRequestId) {
      throw new PublishingDeliveryError(providerOutcomeUnknownCode, true);
    }
    return {
      providerRequestId,
      response: sanitizeProviderResponse(payload, providerRequestId),
    };
  }

  private providerHttpError(status: number, code: string) {
    if (status === 408 || status >= 500) {
      return new PublishingDeliveryError(providerOutcomeUnknownCode, true);
    }
    const permanent =
      status >= 400 && status < 500 && status !== 408 && status !== 429;
    return new PublishingDeliveryError(code, permanent);
  }

  private async waitForInstagramContainer(containerId: string, token: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const url = new URL(
        `https://graph.facebook.com/v22.0/${encodeURIComponent(containerId)}`,
      );
      url.search = new URLSearchParams({
        access_token: token,
        fields: 'status_code',
      }).toString();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await responseJson(response);
      if (!response.ok)
        throw this.providerHttpError(
          response.status,
          'PUBLISHING_META_REJECTED',
        );
      const status = firstString(payload, ['status_code']);
      if (status === 'FINISHED') return;
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new PublishingDeliveryError(
          'PUBLISHING_INSTAGRAM_CONTAINER_FAILED',
          true,
        );
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
    }
    throw new PublishingDeliveryError('PUBLISHING_INSTAGRAM_CONTAINER_TIMEOUT');
  }

  private publicMediaUrl(assetId: string, variant?: string) {
    if (!this.apiPublicOrigin) {
      throw new PublishingDeliveryError(
        'PUBLISHING_PUBLIC_ORIGIN_MISSING',
        true,
      );
    }
    const expires = Math.floor(Date.now() / 1000) + 15 * 60;
    const signature = createHmac('sha256', this.signingKey)
      .update(`${assetId}.${variant ?? ''}.${expires}`)
      .digest('hex');
    const url = new URL(
      `/v1/public/publishing-media/${encodeURIComponent(assetId)}`,
      this.apiPublicOrigin,
    );
    url.search = new URLSearchParams({
      expires: String(expires),
      signature,
      ...(variant ? { variant } : {}),
    }).toString();
    return url.toString();
  }

  private async assetForm(asset: PreparedPublishingAsset, token: string) {
    const form = new FormData();
    form.set('access_token', token);
    form.set('source', await this.assetBlob(asset), asset.name);
    return form;
  }

  private async assetBlob(asset: PreparedPublishingAsset) {
    const path = resolve(this.storageRoot, asset.storageKey);
    if (!path.startsWith(`${this.storageRoot}/`)) {
      throw new PublishingDeliveryError('PUBLISHING_MEDIA_NOT_AVAILABLE', true);
    }
    const bytes = await readFile(path).catch(() => null);
    if (!bytes || bytes.length !== asset.sizeBytes) {
      throw new PublishingDeliveryError('PUBLISHING_MEDIA_NOT_AVAILABLE', true);
    }
    return new Blob([bytes], { type: asset.mimeType });
  }

  private async finishSucceeded(
    post: Post,
    attempt: Attempt,
    result: ProviderResult,
    job: Job,
  ) {
    const now = new Date();
    const finished = await this.database.db.transaction(async (tx) => {
      const [updatedAttempt] = await tx
        .update(publishingPostAttempts)
        .set({
          status: 'succeeded',
          providerRequestId: result.providerRequestId,
          response: result.response,
          errorCode: null,
          finishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(publishingPostAttempts.id, attempt.id),
            eq(publishingPostAttempts.status, 'processing'),
          ),
        )
        .returning({ id: publishingPostAttempts.id });
      if (!updatedAttempt) return false;
      const [updatedPost] = await tx
        .update(publishingPosts)
        .set({
          status: 'published',
          providerResult: result.response,
          failureCode: null,
          publishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(publishingPosts.id, post.id),
            eq(publishingPosts.workspaceId, post.workspaceId),
            eq(publishingPosts.status, 'processing'),
          ),
        )
        .returning({ id: publishingPosts.id });
      if (!updatedPost) throw new Error('PUBLISHING_STATE_CONFLICT');
      await this.events.emitInTransaction(tx, {
        workspaceId: post.workspaceId,
        event: 'post.published',
        subjectId: post.id,
        payload: {
          postId: post.id,
          providerRequestId: result.providerRequestId,
        },
      });
      return true;
    });
    if (!finished) return;
    await Promise.allSettled([
      this.audit.write({
        workspaceId: post.workspaceId,
        actorUserId: post.authorUserId,
        event: 'publishing.post_delivered',
        severity: 'success',
        outcome: 'succeeded',
        queueName: PUBLISHING_DELIVERY_QUEUE,
        jobId: String(job.id ?? ''),
        attempt: attempt.attemptNumber,
        metadata: { publishingPostId: post.id },
      }),
    ]);
  }

  private async finishFailed(
    post: Post,
    attempt: Attempt,
    errorCode: string,
    finalAttempt: boolean,
    job: Job,
  ) {
    const now = new Date();
    const finished = await this.database.db.transaction(async (tx) => {
      const [updatedAttempt] = await tx
        .update(publishingPostAttempts)
        .set({
          status: finalAttempt ? 'failed' : 'queued',
          errorCode,
          finishedAt: finalAttempt ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(publishingPostAttempts.id, attempt.id),
            eq(publishingPostAttempts.status, 'processing'),
          ),
        )
        .returning({ id: publishingPostAttempts.id });
      if (!updatedAttempt) return false;
      if (finalAttempt) {
        const [updatedPost] = await tx
          .update(publishingPosts)
          .set({ status: 'failed', failureCode: errorCode, updatedAt: now })
          .where(
            and(
              eq(publishingPosts.id, post.id),
              eq(publishingPosts.workspaceId, post.workspaceId),
              eq(publishingPosts.status, 'processing'),
            ),
          )
          .returning({ id: publishingPosts.id });
        if (!updatedPost) throw new Error('PUBLISHING_STATE_CONFLICT');
        await this.events.emitInTransaction(tx, {
          workspaceId: post.workspaceId,
          event: 'post.failed',
          subjectId: post.id,
          occurrenceId: attempt.id,
          payload: { postId: post.id, errorCode },
        });
      }
      return true;
    });
    if (!finished) return;
    await Promise.allSettled([
      this.audit.write({
        workspaceId: post.workspaceId,
        actorUserId: post.authorUserId,
        event: 'publishing.post_delivered',
        severity: 'error',
        outcome: finalAttempt ? 'failed' : 'retrying',
        queueName: PUBLISHING_DELIVERY_QUEUE,
        jobId: String(job.id ?? ''),
        attempt: attempt.attemptNumber,
        errorCode,
        metadata: { publishingPostId: post.id },
      }),
    ]);
  }
}

class PublishingDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly permanent = false,
  ) {
    super(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function responseJson(response: Response) {
  const value: unknown = await response.json().catch(() => ({}));
  return isRecord(value) ? value : {};
}

function firstString(
  value: Record<string, unknown>,
  keys: string[],
  maximumLength = 2048,
) {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate) {
      return candidate.slice(0, maximumLength);
    }
  }
  return null;
}

export function sanitizeProviderResponse(
  value: Record<string, unknown>,
  providerRequestId: string | null,
) {
  const response: Record<string, string | number | boolean> = {};
  if (providerRequestId) {
    response.providerRequestId = providerRequestId.slice(0, 2048);
  }
  const providerPostId = firstString(value, ['post_id']);
  if (providerPostId) response.providerPostId = providerPostId;
  const providerMessageId = firstString(value, ['message_id', 'messageId']);
  if (providerMessageId) response.providerMessageId = providerMessageId;
  const status = firstString(value, ['status', 'status_code'], 256);
  if (status) response.status = status;
  const code = value.code;
  if (typeof code === 'string') response.providerCode = code.slice(0, 256);
  else if (typeof code === 'number' || typeof code === 'boolean')
    response.providerCode = code;
  return response;
}

function isProviderSuccess(value: Record<string, unknown>) {
  const code = value.code;
  return (
    code === undefined ||
    (typeof code === 'string' && code.toUpperCase() === 'SUCCESS')
  );
}

function stringMetadata(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  return typeof candidate === 'string' && candidate ? candidate : null;
}

function parseWhatsAppConfiguration(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      typeof parsed.baseUrl !== 'string' ||
      typeof parsed.basicAuthUsername !== 'string' ||
      typeof parsed.basicAuthPassword !== 'string'
    ) {
      return null;
    }
    return {
      baseUrl: parsed.baseUrl.replace(/\/+$/, ''),
      basicAuthUsername: parsed.basicAuthUsername,
      basicAuthPassword: parsed.basicAuthPassword,
    };
  } catch {
    return null;
  }
}
