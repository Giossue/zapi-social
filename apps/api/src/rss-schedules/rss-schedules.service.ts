import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  rssScheduleHistories,
  rssScheduleRuns,
  rssSchedules,
  rssScheduleTargets,
  socialAccounts,
} from '@workspace/database';
import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  sql,
} from '@workspace/database/query';
import {
  createPortalRssScheduleSchema,
  portalRssScheduleHistoryQuerySchema,
  portalRssScheduleIdSchema,
  portalRssScheduleRunsQuerySchema,
  portalRssSchedulesQuerySchema,
  runPortalRssScheduleSchema,
  updatePortalRssScheduleSchema,
  validatePortalRssFeedSchema,
  workspacePermissionMatches,
  type PortalAuthSession,
  type PortalRssFeedValidation,
  type PortalRssSchedule,
  type PortalRssScheduleHistoriesResponse,
  type PortalRssScheduleRunsResponse,
  type PortalRssScheduleRun,
  type PortalRssSchedulesResponse,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { TeamAccountAccessService } from '../teams/team-account-access.service';
import { RssFeedValidationService } from './rss-feed-validation.service';
import {
  RSS_SCHEDULE_RUN_JOB,
  RSS_SCHEDULE_RUN_QUEUE,
  type RssScheduleRunJobData,
} from './rss-schedules.constants';
import type { Queue } from 'bullmq';

const managerRoles = new Set(['owner', 'admin']);
const publishingCapabilities = new Set([
  'facebook_page',
  'instagram_profile',
  'whatsapp_status',
]);
const defaultContentTemplate = '{title}\n\n{summary}\n\nLeer más: {url}';
const feedValidationLimit = 10;
const feedValidationWindowMilliseconds = 60_000;

type RssScheduleRow = typeof rssSchedules.$inferSelect;
type AccountRow = typeof socialAccounts.$inferSelect;
type TargetRow = typeof rssScheduleTargets.$inferSelect;

type ScheduleTarget = {
  target: TargetRow;
  account: AccountRow;
};

@Injectable()
export class RssSchedulesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly feedValidation: RssFeedValidationService,
    private readonly accountAccess: TeamAccountAccessService,
    @InjectQueue(RSS_SCHEDULE_RUN_QUEUE)
    private readonly runQueue: Queue<RssScheduleRunJobData>,
  ) {}

  async validateFeed(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalRssFeedValidation> {
    this.requireManage(session);
    const values = this.parse(validatePortalRssFeedSchema.safeParse(input));
    const windowStart = new Date(Date.now() - feedValidationWindowMilliseconds);
    const [recent] = await this.database.db
      .select({ total: count() })
      .from(apiAuditLogs)
      .where(
        and(
          eq(apiAuditLogs.workspaceId, session.workspace.id),
          eq(apiAuditLogs.actorUserId, session.user.id),
          eq(apiAuditLogs.event, 'rss_schedule.feed_validation_requested'),
          gt(apiAuditLogs.createdAt, windowStart),
        ),
      );
    if (Number(recent?.total ?? 0) >= feedValidationLimit)
      throw new AppException(
        'RSS_FEED_VALIDATION_RATE_LIMITED',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    await this.database.db.insert(apiAuditLogs).values({
      workspaceId: session.workspace.id,
      actorUserId: session.user.id,
      event: 'rss_schedule.feed_validation_requested',
      subjectType: 'rss_feed',
      summary: 'RSS feed validation requested',
      metadata: {},
    });
    const preview = await this.feedValidation.preview(values.feedUrl);
    if (!preview) throw this.invalid();
    await this.database.db.insert(apiAuditLogs).values({
      workspaceId: session.workspace.id,
      actorUserId: session.user.id,
      event: 'rss_schedule.feed_validated',
      subjectType: 'rss_feed',
      summary: 'RSS feed validated',
      metadata: { itemCount: preview.itemCount },
    });
    return preview;
  }

  async list(
    session: PortalAuthSession,
    query: unknown,
  ): Promise<PortalRssSchedulesResponse> {
    const filters = this.parse(portalRssSchedulesQuerySchema.safeParse(query));
    const conditions = [eq(rssSchedules.workspaceId, session.workspace.id)];
    if (filters.status)
      conditions.push(eq(rssSchedules.status, filters.status));
    if (filters.q) {
      const search = `%${filters.q}%`;
      conditions.push(and(ilike(rssSchedules.name, search))!);
    }
    const matchingIds = await this.database.db
      .select({ id: rssSchedules.id })
      .from(rssSchedules)
      .where(and(...conditions));
    const visibleIds = await this.visibleScheduleIds(
      session,
      matchingIds.map(({ id }) => id),
    );
    const where = visibleIds.length
      ? and(...conditions, inArray(rssSchedules.id, visibleIds))!
      : and(...conditions, sql`false`)!;
    const offset = (filters.page - 1) * filters.limit;
    const [rows, totalRows] = await Promise.all([
      this.database.db
        .select()
        .from(rssSchedules)
        .where(where)
        .orderBy(desc(rssSchedules.updatedAt), desc(rssSchedules.id))
        .limit(filters.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(rssSchedules)
        .where(where),
    ]);
    const scheduleIds = rows.map((row) => row.id);
    const [targetsBySchedule, queuedBySchedule] = await Promise.all([
      this.targetsFor(session.workspace.id, scheduleIds),
      this.queuedCountsFor(session.workspace.id, scheduleIds),
    ]);

    return {
      canView: true,
      canManage: this.canManage(session),
      schedules: rows.map((schedule) =>
        this.serialize(
          schedule,
          targetsBySchedule.get(schedule.id) ?? [],
          queuedBySchedule.get(schedule.id) ?? 0,
        ),
      ),
      page: filters.page,
      limit: filters.limit,
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async get(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalRssSchedule> {
    const schedule = await this.findForWorkspace(session, id);
    return this.detail(session.workspace.id, schedule);
  }

  async create(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalRssSchedule> {
    this.requireManage(session);
    const values = this.parse(createPortalRssScheduleSchema.safeParse(input));
    await this.assertTargetAccounts(session, values.targetSocialAccountIds);
    const now = new Date();
    const [schedule] = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(rssSchedules)
        .values({
          workspaceId: session.workspace.id,
          createdByUserId: session.user.id,
          name: values.name,
          feedUrl: values.feedUrl,
          description: values.description,
          status: values.status,
          timezone: values.timezone,
          timeSlots: values.timeSlots,
          weekdays: values.weekdays,
          startDate: values.startDate ?? null,
          endDate: values.endDate ?? null,
          contentRules: values.contentRules,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw this.failed();
      await tx.insert(rssScheduleTargets).values(
        values.targetSocialAccountIds.map((socialAccountId) => ({
          rssScheduleId: created.id,
          workspaceId: session.workspace.id,
          socialAccountId,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'rss_schedule.created',
        subjectType: 'rss_schedule',
        subjectId: created.id,
        summary: 'RSS schedule created',
        metadata: { targetCount: values.targetSocialAccountIds.length },
      });
      return [created];
    });
    if (!schedule) throw this.failed();
    return this.detail(session.workspace.id, schedule);
  }

  async update(
    session: PortalAuthSession,
    id: string,
    input: unknown,
  ): Promise<PortalRssSchedule> {
    this.requireManage(session);
    const scheduleId = this.parseId(id);
    const values = this.parse(updatePortalRssScheduleSchema.safeParse(input));
    const { targetSocialAccountIds, ...scheduleValues } = values;
    const existing = await this.findForWorkspace(session, scheduleId);
    if (targetSocialAccountIds)
      await this.assertTargetAccounts(session, targetSocialAccountIds);

    const startDate =
      values.startDate === undefined ? existing.startDate : values.startDate;
    const endDate =
      values.endDate === undefined ? existing.endDate : values.endDate;
    if (startDate && endDate && startDate > endDate) throw this.invalid();

    const [schedule] = await this.database.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(rssSchedules)
        .set({
          ...scheduleValues,
          startDate,
          endDate,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(rssSchedules.id, scheduleId),
            eq(rssSchedules.workspaceId, session.workspace.id),
          ),
        )
        .returning();
      if (!updated) throw this.notFound();
      if (targetSocialAccountIds) {
        await tx
          .delete(rssScheduleTargets)
          .where(eq(rssScheduleTargets.rssScheduleId, updated.id));
        await tx.insert(rssScheduleTargets).values(
          targetSocialAccountIds.map((socialAccountId) => ({
            rssScheduleId: updated.id,
            workspaceId: session.workspace.id,
            socialAccountId,
          })),
        );
      }
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'rss_schedule.updated',
        subjectType: 'rss_schedule',
        subjectId: updated.id,
        summary: 'RSS schedule updated',
        metadata: { changedFields: Object.keys(values) },
      });
      return [updated];
    });
    if (!schedule) throw this.notFound();
    return this.detail(session.workspace.id, schedule);
  }

  async toggle(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalRssSchedule> {
    this.requireManage(session);
    const schedule = await this.findForWorkspace(session, id);
    const status = schedule.status === 'active' ? 'paused' : 'active';
    const [updated] = await this.database.db.transaction(async (tx) => {
      const [next] = await tx
        .update(rssSchedules)
        .set({ status, updatedAt: new Date() })
        .where(eq(rssSchedules.id, schedule.id))
        .returning();
      if (!next) throw this.notFound();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'rss_schedule.toggled',
        subjectType: 'rss_schedule',
        subjectId: next.id,
        summary: `RSS schedule ${status}`,
        metadata: { status },
      });
      return [next];
    });
    if (!updated) throw this.notFound();
    return this.detail(session.workspace.id, updated);
  }

  async run(
    session: PortalAuthSession,
    id: string,
    input: unknown,
  ): Promise<PortalRssScheduleRun> {
    this.requireManage(session);
    const schedule = await this.findForWorkspace(session, id);
    const values = this.parse(runPortalRssScheduleSchema.safeParse(input));
    const now = new Date();
    const run = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(rssScheduleRuns)
        .values({
          workspaceId: session.workspace.id,
          rssScheduleId: schedule.id,
          trigger: 'manual',
          triggeredByUserId: session.user.id,
          status: 'queued',
          metadata: { ignoreHistory: values.ignoreHistory },
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw this.failed();
      const jobId = `rss-schedule-run-${created.id}`;
      const [updated] = await tx
        .update(rssScheduleRuns)
        .set({ jobId, updatedAt: now })
        .where(eq(rssScheduleRuns.id, created.id))
        .returning();
      if (!updated) throw this.failed();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'rss_schedule.run_requested',
        subjectType: 'rss_schedule',
        subjectId: schedule.id,
        summary: 'RSS schedule run requested',
        metadata: {
          ignoreHistory: values.ignoreHistory,
          rssScheduleRunId: updated.id,
        },
      });
      return updated;
    });

    try {
      await this.runQueue.add(
        RSS_SCHEDULE_RUN_JOB,
        {
          ignoreHistory: values.ignoreHistory,
          rssScheduleId: schedule.id,
          rssScheduleRunId: run.id,
          workspaceId: session.workspace.id,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          jobId: run.jobId ?? `rss-schedule-run-${run.id}`,
          removeOnComplete: true,
        },
      );
    } catch {
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(rssScheduleRuns)
          .set({
            errorCode: 'RSS_SCHEDULE_QUEUE_UNAVAILABLE',
            finishedAt: new Date(),
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(rssScheduleRuns.id, run.id));
        await tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'rss_schedule.run_enqueue_failed',
          subjectType: 'rss_schedule',
          subjectId: schedule.id,
          summary: 'RSS schedule run could not be queued',
          errorCode: 'RSS_SCHEDULE_QUEUE_UNAVAILABLE',
          metadata: { rssScheduleRunId: run.id },
        });
      });
      throw new AppException(
        'INFRASTRUCTURE_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.serializeRun(run);
  }

  async remove(session: PortalAuthSession, id: string): Promise<void> {
    this.requireManage(session);
    const schedule = await this.findForWorkspace(session, id);
    await this.database.db.transaction(async (tx) => {
      await tx.delete(rssSchedules).where(eq(rssSchedules.id, schedule.id));
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'rss_schedule.deleted',
        subjectType: 'rss_schedule',
        subjectId: schedule.id,
        summary: 'RSS schedule deleted',
        metadata: {},
      });
    });
  }

  async history(
    session: PortalAuthSession,
    id: string,
    query: unknown,
  ): Promise<PortalRssScheduleHistoriesResponse> {
    const schedule = await this.findForWorkspace(session, id);
    const filters = this.parse(
      portalRssScheduleHistoryQuerySchema.safeParse(query),
    );
    const conditions = [
      eq(rssScheduleHistories.workspaceId, session.workspace.id),
      eq(rssScheduleHistories.rssScheduleId, schedule.id),
    ];
    if (filters.result)
      conditions.push(eq(rssScheduleHistories.result, filters.result));
    const where = and(...conditions)!;
    const offset = (filters.page - 1) * filters.limit;
    const [rows, totalRows] = await Promise.all([
      this.database.db
        .select({ history: rssScheduleHistories, account: socialAccounts })
        .from(rssScheduleHistories)
        .innerJoin(
          rssScheduleTargets,
          eq(rssScheduleHistories.rssScheduleTargetId, rssScheduleTargets.id),
        )
        .innerJoin(
          socialAccounts,
          eq(rssScheduleTargets.socialAccountId, socialAccounts.id),
        )
        .where(where)
        .orderBy(desc(rssScheduleHistories.createdAt))
        .limit(filters.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(rssScheduleHistories)
        .where(where),
    ]);
    return {
      histories: rows.map(({ history, account }) => ({
        id: history.id,
        rssScheduleId: history.rssScheduleId,
        rssScheduleTargetId: history.rssScheduleTargetId,
        publishingPostId: history.publishingPostId,
        targetName: account.displayName,
        itemGuid: history.itemGuid,
        itemUrl: this.urlOrNull(history.itemUrl),
        title: history.title,
        result: history.result,
        errorCode: history.errorCode,
        queuedAt: this.isoOrNull(history.queuedAt),
        publishedAt: this.isoOrNull(history.publishedAt),
        createdAt: history.createdAt.toISOString(),
      })),
      page: filters.page,
      limit: filters.limit,
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async runs(
    session: PortalAuthSession,
    id: string,
    query: unknown,
  ): Promise<PortalRssScheduleRunsResponse> {
    const schedule = await this.findForWorkspace(session, id);
    const filters = this.parse(
      portalRssScheduleRunsQuerySchema.safeParse(query),
    );
    const conditions = [
      eq(rssScheduleRuns.workspaceId, session.workspace.id),
      eq(rssScheduleRuns.rssScheduleId, schedule.id),
    ];
    if (filters.status)
      conditions.push(eq(rssScheduleRuns.status, filters.status));
    const where = and(...conditions)!;
    const offset = (filters.page - 1) * filters.limit;
    const [rows, totalRows] = await Promise.all([
      this.database.db
        .select()
        .from(rssScheduleRuns)
        .where(where)
        .orderBy(desc(rssScheduleRuns.createdAt))
        .limit(filters.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(rssScheduleRuns)
        .where(where),
    ]);
    return {
      runs: rows.map((run) => this.serializeRun(run)),
      page: filters.page,
      limit: filters.limit,
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  private async detail(workspaceId: string, schedule: RssScheduleRow) {
    const [targetsBySchedule, queuedBySchedule] = await Promise.all([
      this.targetsFor(workspaceId, [schedule.id]),
      this.queuedCountsFor(workspaceId, [schedule.id]),
    ]);
    return this.serialize(
      schedule,
      targetsBySchedule.get(schedule.id) ?? [],
      queuedBySchedule.get(schedule.id) ?? 0,
    );
  }

  private async targetsFor(workspaceId: string, scheduleIds: string[]) {
    const targetsBySchedule = new Map<string, ScheduleTarget[]>();
    if (!scheduleIds.length) return targetsBySchedule;
    const rows = await this.database.db
      .select({ target: rssScheduleTargets, account: socialAccounts })
      .from(rssScheduleTargets)
      .innerJoin(
        socialAccounts,
        eq(rssScheduleTargets.socialAccountId, socialAccounts.id),
      )
      .where(
        and(
          eq(rssScheduleTargets.workspaceId, workspaceId),
          inArray(rssScheduleTargets.rssScheduleId, scheduleIds),
        ),
      );
    for (const row of rows) {
      targetsBySchedule.set(row.target.rssScheduleId, [
        ...(targetsBySchedule.get(row.target.rssScheduleId) ?? []),
        row,
      ]);
    }
    return targetsBySchedule;
  }

  private async queuedCountsFor(workspaceId: string, scheduleIds: string[]) {
    const counts = new Map<string, number>();
    if (!scheduleIds.length) return counts;
    const rows = await this.database.db
      .select({ rssScheduleId: rssScheduleHistories.rssScheduleId })
      .from(rssScheduleHistories)
      .where(
        and(
          eq(rssScheduleHistories.workspaceId, workspaceId),
          inArray(rssScheduleHistories.rssScheduleId, scheduleIds),
          eq(rssScheduleHistories.result, 'queued'),
        ),
      );
    for (const row of rows)
      counts.set(row.rssScheduleId, (counts.get(row.rssScheduleId) ?? 0) + 1);
    return counts;
  }

  private async assertTargetAccounts(
    session: PortalAuthSession,
    ids: string[],
  ) {
    const scope = await this.accountAccess.resolve(session);
    if (!this.accountAccess.allowsAll(scope, ids)) throw this.invalid();
    const accounts = await this.database.db
      .select({
        capabilityKey: socialAccounts.capabilityKey,
        id: socialAccounts.id,
      })
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, session.workspace.id),
          eq(socialAccounts.status, 'active'),
          isNull(socialAccounts.disconnectedAt),
          inArray(socialAccounts.id, ids),
        ),
      );
    if (
      accounts.length !== ids.length ||
      accounts.some(
        (account) => !publishingCapabilities.has(account.capabilityKey),
      )
    )
      throw this.invalid();
  }

  private async visibleScheduleIds(
    session: PortalAuthSession,
    scheduleIds: string[],
  ) {
    if (!scheduleIds.length) return [];
    const scope = await this.accountAccess.resolve(session);
    if (scope.unrestricted) return scheduleIds;
    const targets = await this.targetsFor(session.workspace.id, scheduleIds);
    return scheduleIds.filter((scheduleId) => {
      const accountIds = (targets.get(scheduleId) ?? []).map(
        ({ account }) => account.id,
      );
      return (
        accountIds.length > 0 && this.accountAccess.allowsAll(scope, accountIds)
      );
    });
  }

  private async findForWorkspace(session: PortalAuthSession, id: string) {
    const scheduleId = this.parseId(id);
    const [schedule] = await this.database.db
      .select()
      .from(rssSchedules)
      .where(
        and(
          eq(rssSchedules.id, scheduleId),
          eq(rssSchedules.workspaceId, session.workspace.id),
        ),
      )
      .limit(1);
    if (!schedule) throw this.notFound();
    if (!(await this.visibleScheduleIds(session, [schedule.id])).length)
      throw this.notFound();
    return schedule;
  }

  private serialize(
    schedule: RssScheduleRow,
    targets: ScheduleTarget[],
    queuedCount: number,
  ): PortalRssSchedule {
    return {
      id: schedule.id,
      name: schedule.name,
      feedUrl: schedule.feedUrl,
      description: schedule.description,
      status: schedule.status,
      timezone: schedule.timezone,
      timeSlots: schedule.timeSlots,
      weekdays: schedule.weekdays as PortalRssSchedule['weekdays'],
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      contentRules: this.contentRules(schedule.contentRules),
      targets: targets.map(({ target, account }) => ({
        id: target.id,
        socialAccountId: account.id,
        displayName: account.displayName,
        providerKey: account.providerKey,
        connected: account.status === 'active' && !account.disconnectedAt,
      })),
      lastCheckedAt: this.isoOrNull(schedule.lastCheckedAt),
      lastQueuedAt: this.isoOrNull(schedule.lastQueuedAt),
      nextRunAt: this.isoOrNull(schedule.nextRunAt),
      queuedCount,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
    };
  }

  private serializeRun(run: typeof rssScheduleRuns.$inferSelect) {
    return {
      id: run.id,
      rssScheduleId: run.rssScheduleId,
      trigger: run.trigger,
      status: run.status,
      startedAt: this.isoOrNull(run.startedAt),
      finishedAt: this.isoOrNull(run.finishedAt),
      feedItemsRead: run.feedItemsRead,
      queuedCount: run.queuedCount,
      skippedCount: run.skippedCount,
      failedCount: run.failedCount,
      errorCode: run.errorCode,
      createdAt: run.createdAt.toISOString(),
    } satisfies PortalRssScheduleRun;
  }

  private contentRules(value: Record<string, unknown>) {
    return {
      includeLink: value.includeLink !== false,
      includeSummary: value.includeSummary !== false,
      template:
        typeof value.template === 'string' && value.template.trim()
          ? value.template
          : defaultContentTemplate,
    };
  }

  private parse<T>(result: { success: boolean; data?: T }): T {
    if (!result.success) throw this.invalid();
    return result.data as T;
  }

  private parseId(id: string) {
    if (!portalRssScheduleIdSchema.safeParse({ id }).success)
      throw this.notFound();
    return id;
  }

  private canManage(session: PortalAuthSession) {
    return (
      managerRoles.has(session.workspace.role) ||
      workspacePermissionMatches(
        session.workspace.permissions,
        'rss-schedules.manage',
      )
    );
  }

  private requireManage(session: PortalAuthSession) {
    if (!this.canManage(session))
      throw new AppException(
        'AUTH_PORTAL_ACCESS_REQUIRED',
        HttpStatus.FORBIDDEN,
      );
  }

  private isoOrNull(value: Date | null) {
    return value ? value.toISOString() : null;
  }

  private urlOrNull(value: string | null) {
    if (!value) return null;
    try {
      return new URL(value).toString();
    } catch {
      return null;
    }
  }

  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private notFound() {
    return new AppException('REQUEST_FAILED', HttpStatus.NOT_FOUND);
  }

  private failed() {
    return new AppException(
      'INTERNAL_SERVER_ERROR',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
