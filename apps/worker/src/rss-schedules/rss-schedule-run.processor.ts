import { createHash } from 'node:crypto';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  publishingPosts,
  rssScheduleHistories,
  rssScheduleRuns,
  rssSchedules,
  rssScheduleTargets,
  socialAccounts,
} from '@workspace/database';
import { and, eq, isNull, or } from '@workspace/database/query';
import type { Job } from 'bullmq';
import { WorkerAuditService } from '../audit/worker-audit.service';
import { AutomationWebhookEventsService } from '../automation/automation-webhook-events.service';
import { DatabaseService } from '../database/database.service';
import {
  RSS_SCHEDULE_RUN_CONCURRENCY,
  RSS_SCHEDULE_RUN_JOB,
  RSS_SCHEDULE_RUN_QUEUE,
  type RssScheduleRunJobData,
} from './rss-schedules.constants';
import {
  RssFeedReadError,
  RssFeedReaderService,
  type RssFeedItem,
} from './rss-feed-reader.service';

const publishingCapabilities = new Set([
  'facebook_page',
  'instagram_profile',
  'whatsapp_status',
]);
const defaultTemplate = '{title}\n\n{summary}\n\nLeer más: {url}';

type Schedule = typeof rssSchedules.$inferSelect;
type Target = {
  account: typeof socialAccounts.$inferSelect;
  target: typeof rssScheduleTargets.$inferSelect;
};

@Injectable()
@Processor(RSS_SCHEDULE_RUN_QUEUE, {
  concurrency: RSS_SCHEDULE_RUN_CONCURRENCY,
})
export class RssScheduleRunProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: WorkerAuditService,
    private readonly feeds: RssFeedReaderService,
    private readonly events: AutomationWebhookEventsService,
  ) {
    super();
  }

  async process(job: Job<RssScheduleRunJobData>): Promise<void> {
    if (job.name !== RSS_SCHEDULE_RUN_JOB) return;
    const started = await this.startRun(job.data);
    if (!started) return;

    const schedule = await this.scheduleForRun(job.data);
    if (!schedule) {
      await this.finishRun(job.data.rssScheduleRunId, {
        errorCode: 'RSS_SCHEDULE_NOT_FOUND',
        status: 'failed',
      });
      return;
    }

    try {
      const [items, targets] = await Promise.all([
        this.feeds.read(schedule.feedUrl),
        this.targetsFor(schedule),
      ]);
      let queuedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const target of targets) {
        for (const item of items) {
          try {
            const queued = await this.createDraft({
              ignoreHistory: job.data.ignoreHistory,
              item,
              schedule,
              target,
              runId: job.data.rssScheduleRunId,
            });
            if (queued) {
              queuedCount += 1;
              break;
            }
            skippedCount += 1;
          } catch {
            failedCount += 1;
            break;
          }
        }
      }

      const now = new Date();
      await this.database.db
        .update(rssSchedules)
        .set({
          lastCheckedAt: now,
          ...(queuedCount ? { lastQueuedAt: now } : {}),
          updatedAt: now,
        })
        .where(
          and(
            eq(rssSchedules.id, schedule.id),
            eq(rssSchedules.workspaceId, schedule.workspaceId),
          ),
        );
      await this.finishRun(job.data.rssScheduleRunId, {
        failedCount,
        feedItemsRead: items.length,
        queuedCount,
        skippedCount,
        status: failedCount ? 'failed' : 'succeeded',
      });
      await this.audit.write({
        workspaceId: schedule.workspaceId,
        actorUserId: schedule.createdByUserId,
        event: 'rss_schedule.processed',
        severity: failedCount ? 'warning' : 'success',
        outcome: failedCount ? 'completed_with_errors' : 'succeeded',
        queueName: RSS_SCHEDULE_RUN_QUEUE,
        jobId: job.id,
        attempt: job.attemptsMade,
        errorCode: failedCount ? 'RSS_DRAFT_CREATE_FAILED' : null,
        summary: `RSS schedule created ${queuedCount} draft${queuedCount === 1 ? '' : 's'}`,
        metadata: {
          failedCount,
          feedItemsRead: items.length,
          queuedCount,
          rssScheduleId: schedule.id,
          rssScheduleRunId: job.data.rssScheduleRunId,
          skippedCount,
        },
      });
    } catch (error) {
      const errorCode =
        error instanceof RssFeedReadError
          ? error.code
          : 'RSS_SCHEDULE_PROCESSING_FAILED';
      const now = new Date();
      await this.database.db
        .update(rssSchedules)
        .set({ lastCheckedAt: now, updatedAt: now })
        .where(
          and(
            eq(rssSchedules.id, schedule.id),
            eq(rssSchedules.workspaceId, schedule.workspaceId),
          ),
        );
      await this.finishRun(job.data.rssScheduleRunId, {
        errorCode,
        status: 'failed',
      });
      await this.audit.write({
        workspaceId: schedule.workspaceId,
        actorUserId: schedule.createdByUserId,
        event: 'rss_schedule.processed',
        severity: 'error',
        outcome: 'failed',
        queueName: RSS_SCHEDULE_RUN_QUEUE,
        jobId: job.id,
        attempt: job.attemptsMade,
        errorCode,
        summary: 'RSS schedule processing failed',
        metadata: {
          rssScheduleId: schedule.id,
          rssScheduleRunId: job.data.rssScheduleRunId,
        },
      });
      throw new Error(errorCode);
    }
  }

  private async startRun(data: RssScheduleRunJobData) {
    const [run] = await this.database.db
      .update(rssScheduleRuns)
      .set({
        errorCode: null,
        finishedAt: null,
        startedAt: new Date(),
        status: 'running',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rssScheduleRuns.id, data.rssScheduleRunId),
          eq(rssScheduleRuns.rssScheduleId, data.rssScheduleId),
          eq(rssScheduleRuns.workspaceId, data.workspaceId),
          or(
            eq(rssScheduleRuns.status, 'queued'),
            eq(rssScheduleRuns.status, 'running'),
            eq(rssScheduleRuns.status, 'failed'),
          ),
        ),
      )
      .returning({ id: rssScheduleRuns.id });
    return run ?? null;
  }

  private async scheduleForRun(data: RssScheduleRunJobData) {
    const [schedule] = await this.database.db
      .select()
      .from(rssSchedules)
      .where(
        and(
          eq(rssSchedules.id, data.rssScheduleId),
          eq(rssSchedules.workspaceId, data.workspaceId),
        ),
      )
      .limit(1);
    return schedule ?? null;
  }

  private async targetsFor(schedule: Schedule): Promise<Target[]> {
    const targets = await this.database.db
      .select({ account: socialAccounts, target: rssScheduleTargets })
      .from(rssScheduleTargets)
      .innerJoin(
        socialAccounts,
        eq(rssScheduleTargets.socialAccountId, socialAccounts.id),
      )
      .where(
        and(
          eq(rssScheduleTargets.rssScheduleId, schedule.id),
          eq(rssScheduleTargets.workspaceId, schedule.workspaceId),
          eq(socialAccounts.workspaceId, schedule.workspaceId),
          eq(socialAccounts.status, 'active'),
          isNull(socialAccounts.disconnectedAt),
        ),
      );
    return targets.filter((target) =>
      publishingCapabilities.has(target.account.capabilityKey),
    );
  }

  private async createDraft({
    ignoreHistory,
    item,
    schedule,
    target,
    runId,
  }: {
    ignoreHistory: boolean;
    item: RssFeedItem;
    runId: string;
    schedule: Schedule;
    target: Target;
  }) {
    const content = this.contentFor(schedule, item);
    if (!content) return false;
    const contentHash = ignoreHistory
      ? createHash('sha256')
          .update(`${item.contentHash}\u0000${runId}`)
          .digest('hex')
      : item.contentHash;
    const now = new Date();

    try {
      const postId = await this.database.db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: rssScheduleHistories.id })
          .from(rssScheduleHistories)
          .where(
            and(
              eq(rssScheduleHistories.rssScheduleId, schedule.id),
              eq(rssScheduleHistories.rssScheduleTargetId, target.target.id),
              eq(rssScheduleHistories.contentHash, contentHash),
            ),
          )
          .limit(1);
        if (existing) return null;

        const [history] = await tx
          .insert(rssScheduleHistories)
          .values({
            workspaceId: schedule.workspaceId,
            rssScheduleId: schedule.id,
            rssScheduleTargetId: target.target.id,
            contentHash,
            itemGuid: item.guid,
            itemUrl: item.url,
            title: item.title?.slice(0, 500) ?? null,
            result: 'queued',
            queuedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!history) throw new Error('RSS_HISTORY_CREATE_FAILED');
        const [post] = await tx
          .insert(publishingPosts)
          .values({
            workspaceId: schedule.workspaceId,
            authorUserId: schedule.createdByUserId,
            socialAccountId: target.account.id,
            status: 'draft',
            content,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: publishingPosts.id });
        if (!post) throw new Error('RSS_DRAFT_CREATE_FAILED');
        await tx
          .update(rssScheduleHistories)
          .set({ publishingPostId: post.id, updatedAt: now })
          .where(eq(rssScheduleHistories.id, history.id));
        return post.id;
      });
      if (!postId) return false;
      await this.events.emit({
        workspaceId: schedule.workspaceId,
        event: 'post.created',
        subjectId: postId,
        payload: { postId, source: 'rss' },
      });
      return true;
    } catch (error) {
      if (this.isUniqueViolation(error)) return false;
      throw error;
    }
  }

  private contentFor(schedule: Schedule, item: RssFeedItem) {
    const rules = schedule.contentRules;
    const template =
      typeof rules.template === 'string' && rules.template.trim()
        ? rules.template
        : defaultTemplate;
    const values = {
      summary: rules.includeSummary === false ? '' : (item.summary ?? ''),
      title: item.title ?? '',
      url: rules.includeLink === false ? '' : (item.url ?? ''),
    };
    const content = template
      .replaceAll('{title}', values.title)
      .replaceAll('{summary}', values.summary)
      .replaceAll('{url}', values.url)
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return content ? content.slice(0, 10_000) : null;
  }

  private async finishRun(
    runId: string,
    result: {
      errorCode?: string | null;
      failedCount?: number;
      feedItemsRead?: number;
      queuedCount?: number;
      skippedCount?: number;
      status: 'failed' | 'succeeded';
    },
  ) {
    await this.database.db
      .update(rssScheduleRuns)
      .set({
        errorCode: result.errorCode ?? null,
        failedCount: result.failedCount ?? 0,
        feedItemsRead: result.feedItemsRead ?? 0,
        finishedAt: new Date(),
        queuedCount: result.queuedCount ?? 0,
        skippedCount: result.skippedCount ?? 0,
        status: result.status,
        updatedAt: new Date(),
      })
      .where(eq(rssScheduleRuns.id, runId));
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
