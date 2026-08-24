import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  aiPublishingSchedules,
  aiPublishingScheduleTargets,
  aiRequests,
  creditLedgerEntries,
  workspaceCreditAccounts,
} from '@workspace/database';
import { and, eq, inArray, isNull, or, sql } from '@workspace/database/query';
import { splitAiCreditCharge } from '@workspace/contracts';
import type { Job, Queue } from 'bullmq';
import { WorkerAuditService } from '../audit/worker-audit.service';
import { DatabaseService } from '../database/database.service';
import { PlanAccessService } from '../plans/plan-access.service';
import { nextRssScheduleRun } from '../rss-schedules/rss-schedule-time';
import {
  AI_REQUEST_JOB,
  AI_REQUEST_QUEUE,
  AI_SCHEDULE_DISPATCH_JOB,
  AI_SCHEDULE_DISPATCH_QUEUE,
  type AiRequestJobData,
  type AiScheduleDispatchJobData,
} from './ai.constants';

const batchSize = 50;
const allWeekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const shortWeekday: Record<string, string> = {
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
  sunday: 'sun',
};

type Schedule = typeof aiPublishingSchedules.$inferSelect;

@Injectable()
@Processor(AI_SCHEDULE_DISPATCH_QUEUE)
export class AiScheduleDispatchProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: WorkerAuditService,
    private readonly planAccess: PlanAccessService,
    @InjectQueue(AI_REQUEST_QUEUE)
    private readonly requests: Queue<AiRequestJobData>,
  ) {
    super();
  }

  async process(job: Job<AiScheduleDispatchJobData>) {
    if (job.name !== AI_SCHEDULE_DISPATCH_JOB) return;
    const now = new Date();
    const schedules = await this.database.db
      .select()
      .from(aiPublishingSchedules)
      .where(
        and(
          eq(aiPublishingSchedules.status, 'active'),
          or(
            isNull(aiPublishingSchedules.nextRunAt),
            sql`${aiPublishingSchedules.nextRunAt} <= ${now}`,
          ),
        ),
      )
      .limit(batchSize);
    for (const schedule of schedules) await this.dispatch(schedule, now);
  }

  async recoverQueuedRequests() {
    const queued = await this.database.db
      .select({ id: aiRequests.id, workspaceId: aiRequests.workspaceId })
      .from(aiRequests)
      .where(eq(aiRequests.status, 'queued'))
      .limit(500);
    for (const request of queued) {
      await this.enqueue(request.id, request.workspaceId).catch(
        () => undefined,
      );
    }
  }

  private async dispatch(schedule: Schedule, now: Date) {
    if (
      !(await this.planAccess.moduleAvailable(
        schedule.workspaceId,
        'ai-publishing',
      ))
    ) {
      await this.database.db
        .update(aiPublishingSchedules)
        .set({ status: 'paused', nextRunAt: null, updatedAt: now })
        .where(eq(aiPublishingSchedules.id, schedule.id));
      return;
    }
    const limits = await this.planAccess.limitsFor(schedule.workspaceId);
    const aiPublishingCostUnits = limits.aiActionCosts.ai_publishing;
    const nextRunAt = this.nextRun(schedule, now);
    if (!schedule.nextRunAt) {
      await this.database.db
        .update(aiPublishingSchedules)
        .set({ nextRunAt, updatedAt: now })
        .where(
          and(
            eq(aiPublishingSchedules.id, schedule.id),
            eq(aiPublishingSchedules.status, 'active'),
            isNull(aiPublishingSchedules.nextRunAt),
          ),
        );
      return;
    }

    const targets = await this.database.db
      .select({ socialAccountId: aiPublishingScheduleTargets.socialAccountId })
      .from(aiPublishingScheduleTargets)
      .where(eq(aiPublishingScheduleTargets.scheduleId, schedule.id));
    const idempotencyKey = `ai-schedule-${schedule.id}-${schedule.nextRunAt.getTime()}`;
    const created = await this.database.db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(aiPublishingSchedules)
        .set({ nextRunAt, updatedAt: now })
        .where(
          and(
            eq(aiPublishingSchedules.id, schedule.id),
            eq(aiPublishingSchedules.status, 'active'),
            eq(aiPublishingSchedules.nextRunAt, schedule.nextRunAt!),
          ),
        )
        .returning({ id: aiPublishingSchedules.id });
      if (!claimed) return null;

      const [existing] = await tx
        .select({ id: aiRequests.id, workspaceId: aiRequests.workspaceId })
        .from(aiRequests)
        .where(
          and(
            eq(aiRequests.workspaceId, schedule.workspaceId),
            eq(aiRequests.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) return existing;

      await tx
        .insert(workspaceCreditAccounts)
        .values({
          workspaceId: schedule.workspaceId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${schedule.workspaceId}, 0))`,
      );
      const [creditAccount] = await tx
        .select()
        .from(workspaceCreditAccounts)
        .where(eq(workspaceCreditAccounts.workspaceId, schedule.workspaceId))
        .limit(1);
      if (!creditAccount) throw new Error('AI_CREDIT_ACCOUNT_MISSING');
      const [used] = await tx
        .select({
          total: sql<number>`greatest(coalesce(-sum(${creditLedgerEntries.units}), 0), 0)::int`,
        })
        .from(creditLedgerEntries)
        .where(
          and(
            eq(creditLedgerEntries.workspaceId, schedule.workspaceId),
            inArray(creditLedgerEntries.type, ['debit', 'refund']),
            sql`${creditLedgerEntries.createdAt} >= date_trunc('month', now())`,
          ),
        );
      const { allowanceUnits, balanceDebitedUnits } = splitAiCreditCharge({
        accountUnlimited: creditAccount.unlimited,
        costUnits: aiPublishingCostUnits,
        creditsPerMonth: limits.creditsPerMonth,
        usedPlanUnits: used?.total ?? 0,
      });
      if (balanceDebitedUnits > 0) {
        const [debited] = await tx
          .update(workspaceCreditAccounts)
          .set({
            balanceUnits: sql`${workspaceCreditAccounts.balanceUnits} - ${balanceDebitedUnits}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(workspaceCreditAccounts.id, creditAccount.id),
              sql`${workspaceCreditAccounts.balanceUnits} >= ${balanceDebitedUnits}`,
            ),
          )
          .returning({ id: workspaceCreditAccounts.id });
        if (!debited) {
          await tx
            .update(aiPublishingSchedules)
            .set({ status: 'paused', nextRunAt: null, updatedAt: now })
            .where(eq(aiPublishingSchedules.id, schedule.id));
          return null;
        }
      }
      const [request] = await tx
        .insert(aiRequests)
        .values({
          workspaceId: schedule.workspaceId,
          requestedByUserId: schedule.createdByUserId,
          kind: 'ai_publishing',
          prompt: schedule.prompt,
          input: {
            scheduleId: schedule.id,
            tone: schedule.tone,
            targetSocialAccountIds: targets.map(
              (target) => target.socialAccountId,
            ),
          },
          costUnits: aiPublishingCostUnits,
          idempotencyKey,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: aiRequests.id, workspaceId: aiRequests.workspaceId });
      if (!request) return null;
      await tx.insert(creditLedgerEntries).values({
        workspaceId: schedule.workspaceId,
        actorUserId: schedule.createdByUserId,
        aiRequestId: request.id,
        type: 'debit',
        action: 'ai.ai_publishing',
        units: -aiPublishingCostUnits,
        idempotencyKey: `ai-debit-${request.id}`,
        metadata: {
          scheduled: true,
          unlimited: creditAccount.unlimited,
          allowanceUnits,
          balanceDebitedUnits,
        },
      });
      return request;
    });
    if (!created) return;

    try {
      await this.enqueue(created.id, created.workspaceId);
    } catch {
      await this.failAndRefund(created.id, created.workspaceId, schedule);
    }
  }

  private async enqueue(aiRequestId: string, workspaceId: string) {
    const jobId = `ai-${aiRequestId}`;
    await this.requests.add(
      AI_REQUEST_JOB,
      { aiRequestId, workspaceId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        jobId,
        removeOnComplete: 500,
        removeOnFail: 1_000,
      },
    );
    await this.database.db
      .update(aiRequests)
      .set({ jobId, updatedAt: new Date() })
      .where(eq(aiRequests.id, aiRequestId));
  }

  private async failAndRefund(
    aiRequestId: string,
    workspaceId: string,
    schedule: Schedule,
  ) {
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const [request] = await tx
        .update(aiRequests)
        .set({
          status: 'failed',
          errorCode: 'AI_QUEUE_UNAVAILABLE',
          completedAt: now,
          updatedAt: now,
        })
        .where(
          and(eq(aiRequests.id, aiRequestId), eq(aiRequests.status, 'queued')),
        )
        .returning();
      if (!request) return;
      const [[account], [debit]] = await Promise.all([
        tx
          .select()
          .from(workspaceCreditAccounts)
          .where(eq(workspaceCreditAccounts.workspaceId, workspaceId))
          .limit(1),
        tx
          .select({ metadata: creditLedgerEntries.metadata })
          .from(creditLedgerEntries)
          .where(
            eq(creditLedgerEntries.idempotencyKey, `ai-debit-${aiRequestId}`),
          )
          .limit(1),
      ]);
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
        workspaceId,
        actorUserId: schedule.createdByUserId,
        aiRequestId,
        type: 'refund',
        action: 'ai.ai_publishing.refund',
        units: request.costUnits,
        idempotencyKey: `ai-refund-${aiRequestId}`,
        metadata: { reason: 'queue-unavailable' },
      });
    });
    await this.audit.write({
      workspaceId,
      actorUserId: schedule.createdByUserId,
      event: 'ai.schedule_enqueue_failed',
      severity: 'error',
      outcome: 'failed',
      queueName: AI_REQUEST_QUEUE,
      jobId: `ai-${aiRequestId}`,
      errorCode: 'AI_QUEUE_UNAVAILABLE',
      metadata: { aiRequestId, scheduleId: schedule.id },
    });
  }

  private nextRun(schedule: Schedule, reference: Date) {
    const weekdays =
      schedule.frequency === 'daily'
        ? allWeekdays
        : schedule.weekdays
            .map((weekday) => shortWeekday[weekday])
            .filter((weekday): weekday is string => Boolean(weekday));
    return nextRssScheduleRun(
      {
        endDate: null,
        startDate: null,
        timeSlots: [schedule.preferredTime],
        timezone: schedule.timezone,
        weekdays,
      },
      reference,
    );
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
}
