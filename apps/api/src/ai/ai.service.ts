import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  aiPublishingSchedules,
  aiPublishingScheduleTargets,
  aiAgents,
  aiModelRoutes,
  aiModels,
  aiRequests,
  aiUserSettings,
  aiWorkspaceSettings,
  apiAuditLogs,
  creditLedgerEntries,
  fileAssets,
  publishingPostMedia,
  publishingPosts,
  providerIntegrations,
  socialAccounts,
  workspaceCreditAccounts,
} from '@workspace/database';
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from '@workspace/database/query';
import {
  createPortalAiPublishingScheduleSchema,
  createPortalAiRequestSchema,
  aiRequestInputSchemas,
  aiRequestKindSchema,
  isUnlimited,
  splitAiCreditCharge,
  archivePortalAiRequestSchema,
  portalAiRequestsQuerySchema,
  renamePortalAiRequestSchema,
  retryPortalAiRequestSchema,
  updatePortalAiPublishingScheduleSchema,
  updatePortalAiBudgetSchema,
  updatePortalAiSettingsSchema,
  usePortalAiRequestAsDraftSchema,
  workspacePermissionMatches,
  type AiRequestKind,
  type PortalAiPublishingSchedule,
  type PortalAiRequest,
  type PortalAiRequestsResponse,
  type PortalAiSettings,
  type PortalAuthSession,
  type PortalCreditsResponse,
} from '@workspace/contracts';
import type { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { PlanAccessService } from '../plans/plan-access.service';
import { AutomationEventsService } from '../automation/automation-events.service';
import {
  AppException,
  type AppErrorCode,
} from '../platform/errors/app-exception';
import { TeamAccountAccessService } from '../teams/team-account-access.service';
import {
  AI_REQUEST_JOB,
  AI_REQUEST_QUEUE,
  type AiRequestJobData,
} from './ai.constants';

const managerRoles = new Set(['owner', 'admin']);
const requestRateLimit = 10;
const requestRateLimitWindowMilliseconds = 60_000;
@Injectable()
export class AiService {
  constructor(
    private readonly database: DatabaseService,
    private readonly accountAccess: TeamAccountAccessService,
    private readonly events: AutomationEventsService,
    private readonly planAccess: PlanAccessService,
    @InjectQueue(AI_REQUEST_QUEUE)
    private readonly queue: Queue<AiRequestJobData>,
  ) {}

  async listRequests(
    session: PortalAuthSession,
    query: unknown,
  ): Promise<PortalAiRequestsResponse> {
    const parsed = portalAiRequestsQuerySchema.safeParse(query);
    if (!parsed.success) throw this.invalid();
    const conditions = [
      eq(aiRequests.workspaceId, session.workspace.id),
      eq(aiRequests.requestedByUserId, session.user.id),
    ];
    if (!parsed.data.archived) conditions.push(isNull(aiRequests.archivedAt));
    if (parsed.data.kind)
      conditions.push(eq(aiRequests.kind, parsed.data.kind));
    if (parsed.data.status) {
      conditions.push(eq(aiRequests.status, parsed.data.status));
    }
    if (parsed.data.search) {
      const pattern = `%${parsed.data.search}%`;
      conditions.push(
        or(
          ilike(aiRequests.title, pattern),
          ilike(aiRequests.prompt, pattern),
        )!,
      );
    }
    const where = and(...conditions)!;
    const offset = (parsed.data.page - 1) * parsed.data.limit;
    const [requests, totals] = await Promise.all([
      this.database.db
        .select()
        .from(aiRequests)
        .where(where)
        .orderBy(desc(aiRequests.createdAt), desc(aiRequests.id))
        .limit(parsed.data.limit)
        .offset(offset),
      this.database.db.select({ total: count() }).from(aiRequests).where(where),
    ]);
    return {
      requests: requests.map((request) => this.serializeRequest(request)),
      page: parsed.data.page,
      limit: parsed.data.limit,
      total: Number(totals[0]?.total ?? 0),
    };
  }

  async getRequest(session: PortalAuthSession, id: string) {
    return this.serializeRequest(
      await this.findRequest(session, this.parseId(id, 'AI_REQUEST_NOT_FOUND')),
    );
  }

  async createRequest(session: PortalAuthSession, input: unknown) {
    const parsed = createPortalAiRequestSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    if (
      parsed.data.kind === 'repurpose' ||
      parsed.data.kind === 'review' ||
      parsed.data.kind === 'planner'
    ) {
      throw this.invalid();
    }
    return this.createRequestFromValues(session, {
      ...parsed.data,
      input: aiRequestInputSchemas[parsed.data.kind].parse(parsed.data.input),
    });
  }

  async dashboard(session: PortalAuthSession) {
    const cycleStart = new Date();
    cycleStart.setUTCDate(1);
    cycleStart.setUTCHours(0, 0, 0, 0);
    const [credits, requests, providers, draftCount, requestStats] =
      await Promise.all([
        this.credits(session),
        this.database.db
          .select()
          .from(aiRequests)
          .where(
            and(
              eq(aiRequests.workspaceId, session.workspace.id),
              eq(aiRequests.requestedByUserId, session.user.id),
              isNull(aiRequests.archivedAt),
            ),
          )
          .orderBy(desc(aiRequests.createdAt))
          .limit(8),
        this.database.db
          .select({
            enabled: providerIntegrations.enabled,
            readiness: providerIntegrations.readiness,
          })
          .from(providerIntegrations)
          .where(
            inArray(providerIntegrations.providerKey, [
              'openai',
              'atlascloud',
              'deepseek',
              'qwen',
              'anthropic',
            ]),
          ),
        this.database.db
          .select({ total: count() })
          .from(publishingPosts)
          .where(
            and(
              eq(publishingPosts.workspaceId, session.workspace.id),
              eq(publishingPosts.status, 'draft'),
              gte(
                publishingPosts.createdAt,
                new Date(Date.now() - 30 * 86_400_000),
              ),
            ),
          )
          .then((rows) => Number(rows[0]?.total ?? 0)),
        this.database.db
          .select({
            queued: sql<number>`count(*) filter (where ${aiRequests.status} = 'queued')`,
            processing: sql<number>`count(*) filter (where ${aiRequests.status} = 'processing')`,
            succeededThisCycle: sql<number>`count(*) filter (where ${aiRequests.status} = 'succeeded' and ${aiRequests.createdAt} >= ${cycleStart})`,
          })
          .from(aiRequests)
          .where(
            and(
              eq(aiRequests.workspaceId, session.workspace.id),
              eq(aiRequests.requestedByUserId, session.user.id),
              isNull(aiRequests.archivedAt),
            ),
          )
          .then((rows) => rows[0]),
      ]);
    return {
      enabled: true,
      providerReady: providers.some(
        (provider) => provider.enabled && provider.readiness === 'ready',
      ),
      credits: {
        unlimited: credits.unlimited,
        balanceUnits: credits.balanceUnits,
        usedUnits: credits.usedUnits,
      },
      counts: {
        queued: Number(requestStats?.queued ?? 0),
        processing: Number(requestStats?.processing ?? 0),
        succeededThisCycle: Number(requestStats?.succeededThisCycle ?? 0),
        draftsThisCycle: draftCount,
      },
      recentRequests: requests.map((row) => this.serializeRequest(row)),
    };
  }

  async renameRequest(session: PortalAuthSession, id: string, input: unknown) {
    const parsed = renamePortalAiRequestSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const requestId = this.parseId(id, 'AI_REQUEST_NOT_FOUND');
    await this.findRequest(session, requestId);
    const [updated] = await this.database.db
      .update(aiRequests)
      .set({ title: parsed.data.title, updatedAt: new Date() })
      .where(
        and(
          eq(aiRequests.id, requestId),
          eq(aiRequests.workspaceId, session.workspace.id),
          eq(aiRequests.requestedByUserId, session.user.id),
        ),
      )
      .returning();
    if (!updated) throw this.failed();
    return this.serializeRequest(updated);
  }

  async archiveRequest(session: PortalAuthSession, id: string, input: unknown) {
    const parsed = archivePortalAiRequestSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const requestId = this.parseId(id, 'AI_REQUEST_NOT_FOUND');
    await this.findRequest(session, requestId);
    const [updated] = await this.database.db
      .update(aiRequests)
      .set({
        archivedAt: parsed.data.archived ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiRequests.id, requestId),
          eq(aiRequests.workspaceId, session.workspace.id),
          eq(aiRequests.requestedByUserId, session.user.id),
        ),
      )
      .returning();
    if (!updated) throw this.failed();
    return this.serializeRequest(updated);
  }

  async retryRequest(session: PortalAuthSession, id: string, input: unknown) {
    const parsed = retryPortalAiRequestSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const previous = await this.findRequest(
      session,
      this.parseId(id, 'AI_REQUEST_NOT_FOUND'),
    );
    if (previous.status !== 'failed' && previous.status !== 'cancelled') {
      throw new AppException('AI_REQUEST_NOT_CANCELLABLE', HttpStatus.CONFLICT);
    }
    return this.createRequestFromValues(session, {
      kind: previous.kind,
      prompt: previous.prompt,
      input: previous.input,
      idempotencyKey: parsed.data.idempotencyKey,
      title: previous.title,
    });
  }

  async cancelRequest(session: PortalAuthSession, id: string) {
    const requestId = this.parseId(id, 'AI_REQUEST_NOT_FOUND');
    const request = await this.findRequest(session, requestId);
    if (request.status !== 'queued') {
      throw new AppException('AI_REQUEST_NOT_CANCELLABLE', HttpStatus.CONFLICT);
    }
    const now = new Date();
    const [updated] = await this.database.db.transaction(async (tx) => {
      const [cancelled] = await tx
        .update(aiRequests)
        .set({ status: 'cancelled', completedAt: now, updatedAt: now })
        .where(
          and(eq(aiRequests.id, requestId), eq(aiRequests.status, 'queued')),
        )
        .returning();
      if (!cancelled) {
        throw new AppException(
          'AI_REQUEST_NOT_CANCELLABLE',
          HttpStatus.CONFLICT,
        );
      }
      await this.refundInTransaction(
        tx,
        cancelled,
        session.user.id,
        'cancelled',
      );
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'ai.request_cancelled',
        subjectType: 'ai_request',
        subjectId: requestId,
        metadata: { kind: request.kind },
      });
      return [cancelled];
    });
    if (!updated) throw this.failed();
    return this.serializeRequest(updated);
  }

  async useAsDraft(session: PortalAuthSession, id: string, input: unknown) {
    const parsed = usePortalAiRequestAsDraftSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const request = await this.findRequest(
      session,
      this.parseId(id, 'AI_REQUEST_NOT_FOUND'),
    );
    if (request.status !== 'succeeded') {
      throw new AppException('AI_RESULT_NOT_READY', HttpStatus.CONFLICT);
    }
    const result = request.result;
    const content = this.resultText(result);
    const generatedAssetId =
      typeof result.fileAssetId === 'string' ? result.fileAssetId : null;
    const mediaIds = [
      ...new Set([
        ...parsed.data.mediaAssetIds,
        ...(generatedAssetId ? [generatedAssetId] : []),
      ]),
    ];
    if (!content && !mediaIds.length) {
      throw new AppException('AI_RESULT_EMPTY', HttpStatus.CONFLICT);
    }
    const accountScope = await this.accountAccess.resolve(session);
    if (
      !this.accountAccess.allowsAll(accountScope, parsed.data.socialAccountIds)
    ) {
      throw new AppException(
        'AI_DRAFT_RESOURCE_NOT_AVAILABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const [accounts, media] = await Promise.all([
      this.database.db
        .select({ id: socialAccounts.id })
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.workspaceId, session.workspace.id),
            eq(socialAccounts.status, 'active'),
            inArray(socialAccounts.id, parsed.data.socialAccountIds),
          ),
        ),
      mediaIds.length
        ? this.database.db
            .select({ id: fileAssets.id })
            .from(fileAssets)
            .where(
              and(
                eq(fileAssets.workspaceId, session.workspace.id),
                eq(fileAssets.status, 'ready'),
                inArray(fileAssets.id, mediaIds),
              ),
            )
        : Promise.resolve([]),
    ]);
    if (
      accounts.length !== parsed.data.socialAccountIds.length ||
      media.length !== mediaIds.length
    ) {
      throw new AppException(
        'AI_DRAFT_RESOURCE_NOT_AVAILABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const postIds = await this.database.db.transaction(async (tx) => {
      const ids: string[] = [];
      for (const account of accounts) {
        const externalReference = `ai-request-${request.id}`;
        const [existing] = await tx
          .select({ id: publishingPosts.id })
          .from(publishingPosts)
          .where(
            and(
              eq(publishingPosts.workspaceId, session.workspace.id),
              eq(publishingPosts.source, 'ai'),
              eq(publishingPosts.externalReference, externalReference),
              eq(publishingPosts.socialAccountId, account.id),
            ),
          )
          .limit(1);
        if (existing) {
          ids.push(existing.id);
          continue;
        }
        await this.planAccess.requirePostSlot(session.workspace.id);
        const [post] = await tx
          .insert(publishingPosts)
          .values({
            workspaceId: session.workspace.id,
            authorUserId: session.user.id,
            socialAccountId: account.id,
            status: 'draft',
            content,
            source: 'ai',
            externalReference,
          })
          .returning({ id: publishingPosts.id });
        if (!post) throw this.failed();
        if (mediaIds.length) {
          await tx.insert(publishingPostMedia).values(
            mediaIds.map((fileAssetId, position) => ({
              publishingPostId: post.id,
              fileAssetId,
              position,
              workspaceId: session.workspace.id,
            })),
          );
        }
        await this.events.emitInTransaction(tx, {
          workspaceId: session.workspace.id,
          event: 'post.created',
          subjectId: post.id,
          payload: { postId: post.id, source: 'ai' },
        });
        ids.push(post.id);
      }
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'ai.result_used_as_draft',
        subjectType: 'ai_request',
        subjectId: request.id,
        metadata: { postCount: ids.length },
      });
      return ids;
    });
    return { publishingPostIds: postIds };
  }

  async getSettings(session: PortalAuthSession): Promise<PortalAiSettings> {
    const [workspace, user] = await Promise.all([
      this.ensureWorkspaceSettings(session),
      this.database.db
        .select()
        .from(aiUserSettings)
        .where(
          and(
            eq(aiUserSettings.workspaceId, session.workspace.id),
            eq(aiUserSettings.userId, session.user.id),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);
    return this.serializeSettings(workspace, user);
  }

  async updateSettings(session: PortalAuthSession, input: unknown) {
    const parsed = updatePortalAiSettingsSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const workspaceFields = [
      'brandVoice',
      'brandName',
      'brandDescription',
      'brandPersonality',
      'preferredWords',
      'forbiddenWords',
      'requireHumanReview',
      'warnSensitiveClaims',
      'redactPersonalData',
      'defaultTone',
      'language',
    ] as const;
    if (
      workspaceFields.some((field) => parsed.data[field] !== undefined) &&
      !managerRoles.has(session.workspace.role) &&
      !workspacePermissionMatches(
        session.workspace.permissions,
        'ai-studio.manage',
      )
    ) {
      throw new AppException(
        'AI_SETTINGS_MANAGE_FORBIDDEN',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.ensureWorkspaceSettings(session);
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const workspaceChanges = Object.fromEntries(
        workspaceFields
          .filter((field) => parsed.data[field] !== undefined)
          .map((field) => [field, parsed.data[field]]),
      );
      if (Object.keys(workspaceChanges).length) {
        await tx
          .update(aiWorkspaceSettings)
          .set({
            ...workspaceChanges,
            updatedByUserId: session.user.id,
            updatedAt: now,
          })
          .where(eq(aiWorkspaceSettings.workspaceId, session.workspace.id));
      }
      const hasUserChanges =
        parsed.data.userDefaultTone !== undefined ||
        parsed.data.userLanguage !== undefined ||
        parsed.data.userPreferences !== undefined;
      if (hasUserChanges) {
        await tx
          .insert(aiUserSettings)
          .values({
            workspaceId: session.workspace.id,
            userId: session.user.id,
            defaultTone: parsed.data.userDefaultTone ?? null,
            language: parsed.data.userLanguage ?? null,
            preferences: parsed.data.userPreferences ?? {},
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [aiUserSettings.workspaceId, aiUserSettings.userId],
            set: {
              ...(parsed.data.userDefaultTone !== undefined
                ? { defaultTone: parsed.data.userDefaultTone }
                : {}),
              ...(parsed.data.userLanguage !== undefined
                ? { language: parsed.data.userLanguage }
                : {}),
              ...(parsed.data.userPreferences !== undefined
                ? { preferences: parsed.data.userPreferences }
                : {}),
              updatedAt: now,
            },
          });
      }
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'ai.settings_updated',
        subjectType: 'ai_settings',
        metadata: { changedFields: Object.keys(parsed.data) },
      });
    });
    return this.getSettings(session);
  }

  async credits(session: PortalAuthSession): Promise<PortalCreditsResponse> {
    const account = await this.ensureCreditAccount(session.workspace.id);
    const [entries, usage, limits] = await Promise.all([
      this.database.db
        .select()
        .from(creditLedgerEntries)
        .where(eq(creditLedgerEntries.workspaceId, session.workspace.id))
        .orderBy(desc(creditLedgerEntries.createdAt))
        .limit(100),
      this.database.db
        .select({
          total: sql<number>`greatest(coalesce(-sum(${creditLedgerEntries.units}), 0), 0)::int`,
        })
        .from(creditLedgerEntries)
        .where(
          and(
            eq(creditLedgerEntries.workspaceId, session.workspace.id),
            inArray(creditLedgerEntries.type, ['debit', 'refund']),
            sql`${creditLedgerEntries.createdAt} >= date_trunc('month', now())`,
          ),
        )
        .then((rows) => rows[0]?.total ?? 0),
      this.planAccess.limitsFor(session.workspace.id),
    ]);
    const remainingAllowance = isUnlimited(limits.creditsPerMonth)
      ? 0
      : Math.max(limits.creditsPerMonth - usage, 0);
    const cycleStartedAt = new Date();
    cycleStartedAt.setUTCDate(1);
    cycleStartedAt.setUTCHours(0, 0, 0, 0);
    const cycleEndsAt = new Date(cycleStartedAt);
    cycleEndsAt.setUTCMonth(cycleEndsAt.getUTCMonth() + 1);
    return {
      unlimited: account.unlimited || isUnlimited(limits.creditsPerMonth),
      balanceUnits: account.balanceUnits + remainingAllowance,
      usedUnits: usage,
      cycleStartedAt: cycleStartedAt.toISOString(),
      cycleEndsAt: cycleEndsAt.toISOString(),
      entries: entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        action: entry.action,
        units: entry.units,
        aiRequestId: entry.aiRequestId,
        createdAt: entry.createdAt.toISOString(),
      })),
      costs: aiRequestKindSchema.options.map((kind) => ({
        kind,
        units: limits.aiActionCosts[kind],
      })),
      budget: {
        monthlyMicrousd: account.monthlyBudgetMicrousd,
        alertPercent: account.budgetAlertPercent,
        alertsEnabled: account.budgetAlertsEnabled,
      },
    };
  }

  async updateBudget(session: PortalAuthSession, input: unknown) {
    this.requireManage(session);
    const parsed = updatePortalAiBudgetSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    await this.ensureCreditAccount(session.workspace.id);
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(workspaceCreditAccounts)
        .set({
          monthlyBudgetMicrousd: parsed.data.monthlyMicrousd,
          budgetAlertPercent: parsed.data.alertPercent,
          budgetAlertsEnabled: parsed.data.alertsEnabled,
          updatedAt: new Date(),
        })
        .where(eq(workspaceCreditAccounts.workspaceId, session.workspace.id));
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'ai.budget_updated',
        subjectType: 'workspace_credit_account',
        metadata: parsed.data,
      });
    });
    return this.credits(session);
  }

  async listSchedules(session: PortalAuthSession) {
    const accountScope = await this.accountAccess.resolve(session);
    const schedules = await this.database.db
      .select()
      .from(aiPublishingSchedules)
      .where(eq(aiPublishingSchedules.workspaceId, session.workspace.id))
      .orderBy(desc(aiPublishingSchedules.updatedAt));
    const targets = await this.targetsBySchedule(schedules.map(({ id }) => id));
    return schedules.map((schedule) => {
      const accountIds = targets.get(schedule.id) ?? [];
      return this.serializeSchedule(
        schedule,
        this.accountAccess.filter(accountScope, accountIds),
      );
    });
  }

  async createSchedule(session: PortalAuthSession, input: unknown) {
    this.requireManage(session);
    const parsed = createPortalAiPublishingScheduleSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    await this.requireAccounts(session, parsed.data.targetSocialAccountIds);
    const now = new Date();
    const schedule = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(aiPublishingSchedules)
        .values({
          workspaceId: session.workspace.id,
          createdByUserId: session.user.id,
          name: parsed.data.name,
          prompt: parsed.data.prompt,
          status: parsed.data.status,
          frequency: parsed.data.frequency,
          timezone: parsed.data.timezone,
          preferredTime: parsed.data.preferredTime,
          weekdays: parsed.data.weekdays,
          tone: parsed.data.tone,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw this.failed();
      await tx.insert(aiPublishingScheduleTargets).values(
        parsed.data.targetSocialAccountIds.map((socialAccountId) => ({
          scheduleId: created.id,
          workspaceId: session.workspace.id,
          socialAccountId,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'ai_publishing.schedule_created',
        subjectType: 'ai_publishing_schedule',
        subjectId: created.id,
        metadata: { targetCount: parsed.data.targetSocialAccountIds.length },
      });
      return created;
    });
    return this.serializeSchedule(schedule, parsed.data.targetSocialAccountIds);
  }

  async updateSchedule(session: PortalAuthSession, id: string, input: unknown) {
    this.requireManage(session);
    const scheduleId = this.parseId(id, 'AI_PUBLISHING_SCHEDULE_NOT_FOUND');
    const parsed = updatePortalAiPublishingScheduleSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const current = await this.findSchedule(session.workspace.id, scheduleId);
    const nextFrequency = parsed.data.frequency ?? current.frequency;
    const nextWeekdays = parsed.data.weekdays ?? current.weekdays;
    if (nextFrequency === 'weekly' && nextWeekdays.length === 0) {
      throw this.invalid();
    }
    if (parsed.data.targetSocialAccountIds) {
      await this.requireAccounts(session, parsed.data.targetSocialAccountIds);
    }
    const { targetSocialAccountIds, ...changes } = parsed.data;
    const now = new Date();
    const schedule = await this.database.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(aiPublishingSchedules)
        .set({
          ...changes,
          ...(changes.status && changes.status !== 'active'
            ? { nextRunAt: null }
            : changes.status === 'active' ||
                changes.frequency !== undefined ||
                changes.timezone !== undefined ||
                changes.preferredTime !== undefined ||
                changes.weekdays !== undefined
              ? { nextRunAt: null }
              : {}),
          updatedAt: now,
        })
        .where(
          and(
            eq(aiPublishingSchedules.id, scheduleId),
            eq(aiPublishingSchedules.workspaceId, session.workspace.id),
          ),
        )
        .returning();
      if (!updated) throw this.scheduleNotFound();
      if (targetSocialAccountIds) {
        await tx
          .delete(aiPublishingScheduleTargets)
          .where(eq(aiPublishingScheduleTargets.scheduleId, scheduleId));
        await tx.insert(aiPublishingScheduleTargets).values(
          targetSocialAccountIds.map((socialAccountId) => ({
            scheduleId,
            workspaceId: session.workspace.id,
            socialAccountId,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'ai_publishing.schedule_updated',
        subjectType: 'ai_publishing_schedule',
        subjectId: scheduleId,
        metadata: { changedFields: Object.keys(parsed.data) },
      });
      return updated;
    });
    const targets = targetSocialAccountIds
      ? targetSocialAccountIds
      : ((await this.targetsBySchedule([scheduleId])).get(scheduleId) ?? []);
    return this.serializeSchedule(schedule, targets);
  }

  async runSchedule(session: PortalAuthSession, id: string) {
    this.requireManage(session);
    const scheduleId = this.parseId(id, 'AI_PUBLISHING_SCHEDULE_NOT_FOUND');
    const schedule = await this.findSchedule(session.workspace.id, scheduleId);
    const targets =
      (await this.targetsBySchedule([scheduleId])).get(scheduleId) ?? [];
    await this.requireAccounts(session, targets);
    return this.createRequestFromValues(session, {
      kind: 'ai_publishing',
      prompt: schedule.prompt,
      input: {
        scheduleId,
        tone: schedule.tone,
        targetSocialAccountIds: targets,
      },
      idempotencyKey: `ai-publishing-${scheduleId}-${randomUUID()}`,
    });
  }

  async deleteSchedule(session: PortalAuthSession, id: string) {
    this.requireManage(session);
    const scheduleId = this.parseId(id, 'AI_PUBLISHING_SCHEDULE_NOT_FOUND');
    await this.database.db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(aiPublishingSchedules)
        .where(
          and(
            eq(aiPublishingSchedules.id, scheduleId),
            eq(aiPublishingSchedules.workspaceId, session.workspace.id),
          ),
        )
        .returning({ id: aiPublishingSchedules.id });
      if (!removed) throw this.scheduleNotFound();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'ai_publishing.schedule_deleted',
        subjectType: 'ai_publishing_schedule',
        subjectId: scheduleId,
        metadata: {},
      });
    });
  }

  private async createRequestFromValues(
    session: PortalAuthSession,
    values: {
      kind: AiRequestKind;
      prompt: string;
      input: Record<string, unknown>;
      idempotencyKey: string;
      title?: string;
    },
  ) {
    const existing = await this.database.db
      .select()
      .from(aiRequests)
      .where(
        and(
          eq(aiRequests.workspaceId, session.workspace.id),
          eq(aiRequests.requestedByUserId, session.user.id),
          eq(aiRequests.idempotencyKey, values.idempotencyKey),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (existing) return this.serializeRequest(existing);
    const workspaceSettings = await this.ensureWorkspaceSettings(session);
    if (!this.isBrandConfigured(workspaceSettings)) {
      throw new AppException(
        'AI_BRAND_CONFIGURATION_REQUIRED',
        HttpStatus.CONFLICT,
      );
    }
    const windowStartedAt = new Date(
      Date.now() - requestRateLimitWindowMilliseconds,
    );
    const [recentRequests] = await this.database.db
      .select({ total: count() })
      .from(aiRequests)
      .where(
        and(
          eq(aiRequests.workspaceId, session.workspace.id),
          eq(aiRequests.requestedByUserId, session.user.id),
          gte(aiRequests.createdAt, windowStartedAt),
        ),
      );
    if (Number(recentRequests?.total ?? 0) >= requestRateLimit) {
      throw new AppException(
        'AI_REQUEST_RATE_LIMITED',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const [execution, limits] = await Promise.all([
      this.resolveExecution(values.kind, values.input),
      this.planAccess.limitsFor(session.workspace.id),
    ]);
    if (
      values.kind === 'video' &&
      typeof values.input.durationSeconds === 'number' &&
      !isUnlimited(limits.aiVideoMaxSeconds) &&
      values.input.durationSeconds > limits.aiVideoMaxSeconds
    ) {
      throw new AppException('PLAN_LIMIT_REACHED', HttpStatus.FORBIDDEN, {
        limit: 'aiVideoMaxSeconds',
        value: limits.aiVideoMaxSeconds,
      });
    }
    const costUnits = limits.aiActionCosts[values.kind];
    await this.ensureCreditAccount(session.workspace.id);
    const now = new Date();
    let request: typeof aiRequests.$inferSelect;
    try {
      request = await this.database.db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${session.workspace.id}, 0))`,
        );
        const [account] = await tx
          .select()
          .from(workspaceCreditAccounts)
          .where(eq(workspaceCreditAccounts.workspaceId, session.workspace.id))
          .limit(1);
        if (!account) throw this.failed();
        const [used] = await tx
          .select({
            total: sql<number>`greatest(coalesce(-sum(${creditLedgerEntries.units}), 0), 0)::int`,
          })
          .from(creditLedgerEntries)
          .where(
            and(
              eq(creditLedgerEntries.workspaceId, session.workspace.id),
              inArray(creditLedgerEntries.type, ['debit', 'refund']),
              sql`${creditLedgerEntries.createdAt} >= date_trunc('month', now())`,
            ),
          );
        const { allowanceUnits, balanceDebitedUnits } = splitAiCreditCharge({
          accountUnlimited: account.unlimited,
          costUnits,
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
                eq(workspaceCreditAccounts.id, account.id),
                gte(workspaceCreditAccounts.balanceUnits, balanceDebitedUnits),
              ),
            )
            .returning({ id: workspaceCreditAccounts.id });
          if (!debited) {
            throw new AppException(
              'AI_CREDITS_INSUFFICIENT',
              HttpStatus.PAYMENT_REQUIRED,
            );
          }
        }
        const [created] = await tx
          .insert(aiRequests)
          .values({
            workspaceId: session.workspace.id,
            requestedByUserId: session.user.id,
            title:
              values.title ??
              values.prompt.trim().replace(/\s+/g, ' ').slice(0, 160),
            kind: values.kind,
            prompt: values.prompt,
            input: values.input,
            costUnits,
            provider: execution.provider,
            model: execution.model,
            idempotencyKey: values.idempotencyKey,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!created) throw this.failed();
        if (costUnits > 0) {
          await tx.insert(creditLedgerEntries).values({
            workspaceId: session.workspace.id,
            actorUserId: session.user.id,
            aiRequestId: created.id,
            type: 'debit',
            action: `ai.${values.kind}`,
            units: -costUnits,
            idempotencyKey: `ai-debit-${created.id}`,
            metadata: {
              unlimited: account.unlimited,
              enforcementEnabled: true,
              allowanceUnits,
              balanceDebitedUnits,
            },
          });
        }
        await tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'ai.request_created',
          subjectType: 'ai_request',
          subjectId: created.id,
          metadata: { kind: created.kind, costUnits },
        });
        return created;
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const [concurrent] = await this.database.db
        .select()
        .from(aiRequests)
        .where(
          and(
            eq(aiRequests.workspaceId, session.workspace.id),
            eq(aiRequests.requestedByUserId, session.user.id),
            eq(aiRequests.idempotencyKey, values.idempotencyKey),
          ),
        )
        .limit(1);
      if (!concurrent) throw error;
      return this.serializeRequest(concurrent);
    }
    const jobId = `ai-${request.id}`;
    try {
      await this.queue.add(
        AI_REQUEST_JOB,
        { aiRequestId: request.id, workspaceId: session.workspace.id },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 500,
          removeOnFail: 1_000,
        },
      );
      await this.database.db
        .update(aiRequests)
        .set({ jobId, updatedAt: new Date() })
        .where(eq(aiRequests.id, request.id));
      return this.serializeRequest({ ...request, jobId });
    } catch {
      const failed = await this.database.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(aiRequests)
          .set({
            status: 'failed',
            errorCode: 'AI_QUEUE_UNAVAILABLE',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(aiRequests.id, request.id))
          .returning();
        if (updated) {
          await this.refundInTransaction(
            tx,
            updated,
            session.user.id,
            'queue-unavailable',
          );
        }
        return updated;
      });
      if (!failed) throw this.failed();
      return this.serializeRequest(failed);
    }
  }

  private async refundInTransaction(
    tx: Parameters<Parameters<typeof this.database.db.transaction>[0]>[0],
    request: typeof aiRequests.$inferSelect,
    actorUserId: string,
    reason: string,
  ) {
    const key = `ai-refund-${request.id}`;
    const existing = await tx
      .select({ id: creditLedgerEntries.id })
      .from(creditLedgerEntries)
      .where(
        and(
          eq(creditLedgerEntries.workspaceId, request.workspaceId),
          eq(creditLedgerEntries.idempotencyKey, key),
        ),
      )
      .limit(1);
    if (existing.length) return;
    const [[account], [debit]] = await Promise.all([
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
    const balanceDebitedUnits = this.balanceDebitedUnits(
      debit?.metadata,
      request.costUnits,
    );
    if (account && balanceDebitedUnits > 0) {
      await tx
        .update(workspaceCreditAccounts)
        .set({
          balanceUnits: sql`${workspaceCreditAccounts.balanceUnits} + ${balanceDebitedUnits}`,
          updatedAt: new Date(),
        })
        .where(eq(workspaceCreditAccounts.id, account.id));
    }
    if (request.costUnits === 0) return;
    await tx.insert(creditLedgerEntries).values({
      workspaceId: request.workspaceId,
      actorUserId,
      aiRequestId: request.id,
      type: 'refund',
      action: `ai.${request.kind}.refund`,
      units: request.costUnits,
      idempotencyKey: key,
      metadata: { reason },
    });
  }

  private async ensureWorkspaceSettings(session: PortalAuthSession) {
    const now = new Date();
    await this.database.db
      .insert(aiWorkspaceSettings)
      .values({
        workspaceId: session.workspace.id,
        updatedByUserId: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    const [settings] = await this.database.db
      .select()
      .from(aiWorkspaceSettings)
      .where(eq(aiWorkspaceSettings.workspaceId, session.workspace.id))
      .limit(1);
    if (!settings) throw this.failed();
    return settings;
  }

  private isBrandConfigured(settings: typeof aiWorkspaceSettings.$inferSelect) {
    return Boolean(
      settings.brandName.trim() &&
      settings.brandDescription.trim() &&
      settings.brandPersonality.trim(),
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

  private async ensureCreditAccount(workspaceId: string) {
    const now = new Date();
    await this.database.db
      .insert(workspaceCreditAccounts)
      .values({ workspaceId, createdAt: now, updatedAt: now })
      .onConflictDoNothing();
    const [account] = await this.database.db
      .select()
      .from(workspaceCreditAccounts)
      .where(eq(workspaceCreditAccounts.workspaceId, workspaceId))
      .limit(1);
    if (!account) throw this.failed();
    return account;
  }

  private async resolveExecution(
    kind: AiRequestKind,
    input: Record<string, unknown>,
  ) {
    const [route] = await this.database.db
      .select()
      .from(aiModelRoutes)
      .where(eq(aiModelRoutes.kind, kind))
      .limit(1);
    if (!route || !route.enabled) {
      throw new AppException(
        'AI_PROVIDER_NOT_READY',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (kind === 'timing' || kind === 'search') {
      return {
        costUnits: route.costUnits,
        provider: 'internal',
        model: kind === 'timing' ? 'internal-analytics' : 'internal-search',
      };
    }
    if (kind === 'agent') {
      const [orchestrator] = await this.database.db
        .select()
        .from(aiAgents)
        .where(
          and(eq(aiAgents.kind, 'orchestrator'), eq(aiAgents.enabled, true)),
        )
        .limit(1);
      const [orchestratorModel] = orchestrator?.modelId
        ? await this.database.db
            .select()
            .from(aiModels)
            .where(eq(aiModels.id, orchestrator.modelId))
            .limit(1)
        : [];
      const [orchestratorProvider] = orchestratorModel
        ? await this.database.db
            .select()
            .from(providerIntegrations)
            .where(
              eq(
                providerIntegrations.providerKey,
                orchestratorModel.providerKey,
              ),
            )
            .limit(1)
        : [];
      if (
        !orchestratorModel?.enabled ||
        orchestratorModel.deprecated ||
        !orchestratorProvider?.enabled ||
        orchestratorProvider.readiness !== 'ready'
      ) {
        throw new AppException(
          'AI_PROVIDER_NOT_READY',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      return {
        costUnits: route.costUnits,
        provider: orchestratorModel.providerKey,
        model: orchestratorModel.modelId,
      };
    }
    const usesReferences =
      (kind === 'image' || kind === 'video') &&
      Array.isArray(input.referenceAssetIds) &&
      input.referenceAssetIds.length > 0;
    const selectedModelId = usesReferences
      ? route.referenceModelId
      : route.primaryModelId;
    const model = selectedModelId
      ? this.database.db
          .select()
          .from(aiModels)
          .where(eq(aiModels.id, selectedModelId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null);
    const resolvedModel = await model;
    const provider = resolvedModel
      ? await this.database.db
          .select()
          .from(providerIntegrations)
          .where(
            eq(providerIntegrations.providerKey, resolvedModel.providerKey),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;
    const providerReady = Boolean(
      provider?.enabled && provider.readiness === 'ready',
    );
    if (
      !providerReady ||
      !resolvedModel ||
      !resolvedModel.enabled ||
      resolvedModel.deprecated
    ) {
      throw new AppException(
        'AI_PROVIDER_NOT_READY',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return {
      costUnits: route.costUnits,
      provider: resolvedModel.providerKey,
      model: resolvedModel.modelId,
    };
  }

  private async findRequest(session: PortalAuthSession, id: string) {
    const [request] = await this.database.db
      .select()
      .from(aiRequests)
      .where(
        and(
          eq(aiRequests.id, id),
          eq(aiRequests.workspaceId, session.workspace.id),
          eq(aiRequests.requestedByUserId, session.user.id),
        ),
      )
      .limit(1);
    if (!request)
      throw new AppException('AI_REQUEST_NOT_FOUND', HttpStatus.NOT_FOUND);
    return request;
  }

  private async requireAccounts(session: PortalAuthSession, ids: string[]) {
    const accountScope = await this.accountAccess.resolve(session);
    if (!this.accountAccess.allowsAll(accountScope, ids)) {
      throw new AppException(
        'AI_PUBLISHING_TARGET_NOT_AVAILABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const accounts = await this.database.db
      .select({ id: socialAccounts.id })
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, session.workspace.id),
          eq(socialAccounts.status, 'active'),
          inArray(socialAccounts.id, ids),
        ),
      );
    if (accounts.length !== ids.length) {
      throw new AppException(
        'AI_PUBLISHING_TARGET_NOT_AVAILABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async findSchedule(workspaceId: string, id: string) {
    const [schedule] = await this.database.db
      .select()
      .from(aiPublishingSchedules)
      .where(
        and(
          eq(aiPublishingSchedules.id, id),
          eq(aiPublishingSchedules.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!schedule) throw this.scheduleNotFound();
    return schedule;
  }

  private async targetsBySchedule(scheduleIds: string[]) {
    const output = new Map<string, string[]>();
    if (!scheduleIds.length) return output;
    const targets = await this.database.db
      .select()
      .from(aiPublishingScheduleTargets)
      .where(inArray(aiPublishingScheduleTargets.scheduleId, scheduleIds));
    for (const target of targets) {
      const ids = output.get(target.scheduleId) ?? [];
      ids.push(target.socialAccountId);
      output.set(target.scheduleId, ids);
    }
    return output;
  }

  private serializeRequest(
    request: typeof aiRequests.$inferSelect,
  ): PortalAiRequest {
    return {
      id: request.id,
      title: request.title,
      kind: request.kind,
      status: request.status,
      prompt: request.prompt,
      input: request.input,
      result: request.result,
      provider: request.provider,
      model: request.model,
      costUnits: request.costUnits,
      progress: request.progress,
      inputTokens: request.inputTokens,
      outputTokens: request.outputTokens,
      estimatedCostMicrousd: request.estimatedCostMicrousd,
      latencyMs: request.latencyMs,
      errorCode: request.errorCode,
      archivedAt: request.archivedAt?.toISOString() ?? null,
      startedAt: request.startedAt?.toISOString() ?? null,
      completedAt: request.completedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  private serializeSettings(
    workspace: typeof aiWorkspaceSettings.$inferSelect,
    user: typeof aiUserSettings.$inferSelect | null,
  ): PortalAiSettings {
    return {
      preferredProvider: workspace.preferredProvider,
      preferredTextModel: workspace.preferredTextModel,
      preferredImageModel: workspace.preferredImageModel,
      brandConfigured: this.isBrandConfigured(workspace),
      brandVoice: workspace.brandVoice,
      brandName: workspace.brandName,
      brandDescription: workspace.brandDescription,
      brandPersonality: workspace.brandPersonality,
      preferredWords: workspace.preferredWords,
      forbiddenWords: workspace.forbiddenWords,
      requireHumanReview: workspace.requireHumanReview,
      warnSensitiveClaims: workspace.warnSensitiveClaims,
      redactPersonalData: workspace.redactPersonalData,
      defaultTone: workspace.defaultTone,
      language: workspace.language,
      enforceCredits: workspace.enforceCredits,
      user: {
        defaultTone: user?.defaultTone ?? null,
        language: user?.language ?? null,
        preferences: user?.preferences ?? {},
      },
    };
  }

  private serializeSchedule(
    schedule: typeof aiPublishingSchedules.$inferSelect,
    targetSocialAccountIds: string[],
  ): PortalAiPublishingSchedule {
    return {
      id: schedule.id,
      name: schedule.name,
      prompt: schedule.prompt,
      status: schedule.status,
      frequency: schedule.frequency,
      timezone: schedule.timezone,
      preferredTime: schedule.preferredTime,
      weekdays: schedule.weekdays as PortalAiPublishingSchedule['weekdays'],
      tone: schedule.tone,
      targetSocialAccountIds,
      nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
      lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
    };
  }

  private resultText(result: Record<string, unknown>): string {
    if (typeof result.text === 'string') return result.text;
    if (Array.isArray(result.variants)) {
      const first: unknown = (result.variants as unknown[])[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') {
        if ('caption' in first && typeof first.caption === 'string') {
          return first.caption;
        }
        if ('content' in first && typeof first.content === 'string') {
          return first.content;
        }
      }
    }
    if (typeof result.revisedContent === 'string') return result.revisedContent;
    return '';
  }

  private requireManage(session: PortalAuthSession) {
    if (
      !managerRoles.has(session.workspace.role) &&
      !workspacePermissionMatches(
        session.workspace.permissions,
        'ai-publishing.manage',
      )
    ) {
      throw new AppException(
        'AI_PUBLISHING_MANAGE_FORBIDDEN',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private parseId(value: string, code: AppErrorCode) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      throw new AppException(code, HttpStatus.NOT_FOUND);
    }
    return value;
  }

  private scheduleNotFound() {
    return new AppException(
      'AI_PUBLISHING_SCHEDULE_NOT_FOUND',
      HttpStatus.NOT_FOUND,
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
