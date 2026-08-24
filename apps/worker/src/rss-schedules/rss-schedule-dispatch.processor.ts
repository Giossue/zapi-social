import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { rssScheduleRuns, rssSchedules } from '@workspace/database';
import { and, eq, isNull, lte, or } from '@workspace/database/query';
import type { Job, Queue } from 'bullmq';
import { WorkerAuditService } from '../audit/worker-audit.service';
import { DatabaseService } from '../database/database.service';
import {
  RSS_SCHEDULE_DISPATCH_JOB,
  RSS_SCHEDULE_DISPATCH_QUEUE,
  RSS_SCHEDULE_RUN_JOB,
  RSS_SCHEDULE_RUN_QUEUE,
  type RssScheduleDispatchJobData,
  type RssScheduleRunJobData,
} from './rss-schedules.constants';
import { dateKeyInTimezone, nextRssScheduleRun } from './rss-schedule-time';

const dispatchBatchSize = 50;

type Schedule = typeof rssSchedules.$inferSelect;
type QueuedRun = typeof rssScheduleRuns.$inferSelect;

@Injectable()
@Processor(RSS_SCHEDULE_DISPATCH_QUEUE)
export class RssScheduleDispatchProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: WorkerAuditService,
    @InjectQueue(RSS_SCHEDULE_RUN_QUEUE)
    private readonly runs: Queue<RssScheduleRunJobData>,
  ) {
    super();
  }

  async process(job: Job<RssScheduleDispatchJobData>): Promise<void> {
    if (job.name !== RSS_SCHEDULE_DISPATCH_JOB) return;
    const now = new Date();
    const schedules = await this.database.db
      .select()
      .from(rssSchedules)
      .where(
        and(
          eq(rssSchedules.status, 'active'),
          or(isNull(rssSchedules.nextRunAt), lte(rssSchedules.nextRunAt, now)),
        ),
      )
      .limit(dispatchBatchSize);

    for (const schedule of schedules) {
      await this.dispatch(schedule, now);
    }
  }

  async recoverQueuedRuns() {
    const runs = await this.database.db
      .select()
      .from(rssScheduleRuns)
      .where(eq(rssScheduleRuns.status, 'queued'))
      .limit(dispatchBatchSize);
    for (const run of runs) {
      await this.enqueue(run).catch(() => undefined);
    }
  }

  private async dispatch(schedule: Schedule, now: Date) {
    const localDate = dateKeyInTimezone(now, schedule.timezone);
    if (schedule.endDate && localDate > schedule.endDate) {
      await this.database.db
        .update(rssSchedules)
        .set({ nextRunAt: null, status: 'paused', updatedAt: now })
        .where(
          and(
            eq(rssSchedules.id, schedule.id),
            eq(rssSchedules.workspaceId, schedule.workspaceId),
            eq(rssSchedules.status, 'active'),
          ),
        );
      return;
    }

    const nextRunAt = nextRssScheduleRun(schedule, now);
    if (!schedule.nextRunAt) {
      await this.database.db
        .update(rssSchedules)
        .set({
          nextRunAt,
          status: nextRunAt ? 'active' : 'paused',
          updatedAt: now,
        })
        .where(
          and(
            eq(rssSchedules.id, schedule.id),
            eq(rssSchedules.workspaceId, schedule.workspaceId),
            eq(rssSchedules.status, 'active'),
            isNull(rssSchedules.nextRunAt),
          ),
        );
      return;
    }

    const run = await this.database.db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(rssSchedules)
        .set({
          nextRunAt,
          status: nextRunAt ? 'active' : 'paused',
          updatedAt: now,
        })
        .where(
          and(
            eq(rssSchedules.id, schedule.id),
            eq(rssSchedules.workspaceId, schedule.workspaceId),
            eq(rssSchedules.status, 'active'),
            lte(rssSchedules.nextRunAt, now),
          ),
        )
        .returning();
      if (!claimed) return null;
      const [created] = await tx
        .insert(rssScheduleRuns)
        .values({
          workspaceId: schedule.workspaceId,
          rssScheduleId: schedule.id,
          trigger: 'scheduled',
          status: 'queued',
          metadata: { ignoreHistory: false },
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) return null;
      const jobId = `rss-schedule-run-${created.id}`;
      const [updated] = await tx
        .update(rssScheduleRuns)
        .set({ jobId, updatedAt: now })
        .where(eq(rssScheduleRuns.id, created.id))
        .returning();
      return updated ?? null;
    });
    if (!run) return;

    try {
      await this.enqueue(run);
    } catch {
      await this.markEnqueueFailed(run, schedule);
    }
  }

  private async enqueue(run: QueuedRun) {
    const ignoreHistory = run.metadata.ignoreHistory === true;
    await this.runs.add(
      RSS_SCHEDULE_RUN_JOB,
      {
        ignoreHistory,
        rssScheduleId: run.rssScheduleId,
        rssScheduleRunId: run.id,
        workspaceId: run.workspaceId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        jobId: run.jobId ?? `rss-schedule-run-${run.id}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  private async markEnqueueFailed(run: QueuedRun, schedule: Schedule) {
    const now = new Date();
    await this.database.db
      .update(rssScheduleRuns)
      .set({
        errorCode: 'RSS_SCHEDULE_QUEUE_UNAVAILABLE',
        finishedAt: now,
        status: 'failed',
        updatedAt: now,
      })
      .where(eq(rssScheduleRuns.id, run.id));
    await this.audit.write({
      workspaceId: schedule.workspaceId,
      actorUserId: schedule.createdByUserId,
      event: 'rss_schedule.run_enqueue_failed',
      severity: 'error',
      outcome: 'failed',
      queueName: RSS_SCHEDULE_RUN_QUEUE,
      jobId: run.jobId,
      errorCode: 'RSS_SCHEDULE_QUEUE_UNAVAILABLE',
      summary: 'RSS schedule run could not be queued',
      metadata: { rssScheduleId: schedule.id, rssScheduleRunId: run.id },
    });
  }
}
