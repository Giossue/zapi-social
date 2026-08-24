import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  fileAssets,
  publishingPostAttempts,
  publishingPostMedia,
  publishingPosts,
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
import { PublishingMediaPreparationService } from './publishing-media-preparation.service';
import { ChannelPublisherRegistry } from './publishers/channel-publisher.registry';
import {
  PublishingDeliveryError,
  providerOutcomeUnknownCode,
  sanitizeProviderResponse,
  type ProviderResult,
} from './publishers/publishing-provider';

export { sanitizeProviderResponse };

type Account = typeof socialAccounts.$inferSelect;
type Asset = typeof fileAssets.$inferSelect;
type Post = typeof publishingPosts.$inferSelect;
type Attempt = typeof publishingPostAttempts.$inferSelect;
const processingAttemptLeaseMs = 45 * 60_000;

@Injectable()
@Processor(PUBLISHING_DELIVERY_QUEUE, { concurrency: 3 })
export class PublishingDeliveryProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
    private readonly audit: WorkerAuditService,
    private readonly events: AutomationWebhookEventsService,
    private readonly mediaPreparation: PublishingMediaPreparationService,
    private readonly publishers: ChannelPublisherRegistry,
    @InjectQueue(PUBLISHING_DELIVERY_QUEUE)
    private readonly queue: Queue<
      PublishingDeliveryJobData | PublishingDispatchJobData
    >,
  ) {
    super();
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
    const publisher = this.publishers.find(account.capabilityKey);
    if (!publisher) {
      throw new PublishingDeliveryError(
        'PUBLISHING_CAPABILITY_UNSUPPORTED',
        true,
      );
    }
    const prepared = await this.mediaPreparation.prepare(post, account, assets);
    try {
      return await publisher.publish({
        post,
        account,
        assets: prepared.assets,
      });
    } finally {
      await prepared.cleanup();
    }
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
