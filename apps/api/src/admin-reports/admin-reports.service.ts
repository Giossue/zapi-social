import { HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  listAdminTeamsQuerySchema,
  updateAdminTeamModulesSchema,
  type AdminTeamsResponse,
  type AdminUserReportResponse,
} from '@workspace/contracts';
import {
  apiAuditLogs,
  plans,
  socialAccounts,
  users,
  workspaceMemberships,
  workspacePlanAssignments,
  workspaces,
} from '@workspace/database';
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  lt,
  or,
  sql,
} from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { PlanAccessService } from '../plans/plan-access.service';

const THIRTY_DAYS = 30 * 86_400_000;

@Injectable()
export class AdminReportsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly planAccess: PlanAccessService,
  ) {}

  async userReport(): Promise<AdminUserReportResponse> {
    const now = Date.now();
    const currentStart = new Date(now - THIRTY_DAYS);
    const previousStart = new Date(now - 2 * THIRTY_DAYS);
    const yearStart = new Date(now - 365 * 86_400_000);
    const notAdmin = eq(users.isPlatformAdmin, false);

    const [totals, previous, months, locales, byPlan, recent] =
      await Promise.all([
        this.database.db
          .select({
            users: sql<number>`count(*)::int`,
            fresh: sql<number>`count(*) filter (where ${users.createdAt} >= ${currentStart.toISOString()}::timestamptz)::int`,
            verified: sql<number>`count(*) filter (where ${users.emailVerifiedAt} is not null)::int`,
          })
          .from(users)
          .where(notAdmin),
        this.database.db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(
            and(
              notAdmin,
              gte(users.createdAt, previousStart),
              lt(users.createdAt, currentStart),
            ),
          ),
        this.database.db
          .select({
            month: sql<string>`to_char(date_trunc('month', ${users.createdAt}), 'YYYY-MM')`,
            count: sql<number>`count(*)::int`,
          })
          .from(users)
          .where(and(notAdmin, gte(users.createdAt, yearStart)))
          .groupBy(sql`1`)
          .orderBy(sql`1`),
        this.database.db
          .select({
            locale: sql<string>`coalesce(${users.locale}, 'es')`,
            count: sql<number>`count(*)::int`,
          })
          .from(users)
          .where(notAdmin)
          .groupBy(sql`1`)
          .orderBy(sql`2 desc`),
        this.database.db
          .select({
            plan: plans.name,
            count: sql<number>`count(*)::int`,
          })
          .from(workspacePlanAssignments)
          .innerJoin(plans, eq(plans.id, workspacePlanAssignments.planId))
          .groupBy(plans.name)
          .orderBy(sql`2 desc`),
        this.database.db
          .select({
            id: users.id,
            displayName: users.displayName,
            email: users.email,
            locale: users.locale,
            planName: plans.name,
            emailVerifiedAt: users.emailVerifiedAt,
            createdAt: users.createdAt,
          })
          .from(users)
          .leftJoin(
            workspaceMemberships,
            eq(workspaceMemberships.userId, users.id),
          )
          .leftJoin(
            workspacePlanAssignments,
            eq(
              workspacePlanAssignments.workspaceId,
              workspaceMemberships.workspaceId,
            ),
          )
          .leftJoin(plans, eq(plans.id, workspacePlanAssignments.planId))
          .where(notAdmin)
          .orderBy(desc(users.createdAt))
          .limit(60),
      ]);

    const summary = totals[0] ?? { users: 0, fresh: 0, verified: 0 };
    const previousCount = previous[0]?.count ?? 0;
    const seen = new Set<string>();
    const recentRows = recent
      .filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      })
      .slice(0, 20);

    return {
      totals: {
        users: summary.users,
        newLast30Days: summary.fresh,
        growthPct: previousCount
          ? Math.round(((summary.fresh - previousCount) / previousCount) * 100)
          : summary.fresh > 0
            ? 100
            : 0,
        verifiedPct: summary.users
          ? Math.round((summary.verified / summary.users) * 100)
          : 0,
      },
      signupsByMonth: months,
      byLocale: locales,
      workspacesByPlan: byPlan,
      recent: recentRows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        locale: row.locale,
        planName: row.planName,
        verified: Boolean(row.emailVerifiedAt),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async teams(query: unknown): Promise<AdminTeamsResponse> {
    const parsed = listAdminTeamsQuerySchema.safeParse(query ?? {});
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const { q, offset, limit } = parsed.data;
    const owners = users;
    const where = q
      ? or(
          ilike(workspaces.name, `%${q}%`),
          ilike(workspaces.slug, `%${q}%`),
          ilike(owners.email, `%${q}%`),
          ilike(owners.displayName, `%${q}%`),
        )
      : undefined;

    const [rows, counted, memberTotals, accountTotals] = await Promise.all([
      this.database.db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          kind: workspaces.kind,
          ownerName: owners.displayName,
          ownerEmail: owners.email,
          planName: plans.name,
          createdAt: workspaces.createdAt,
          memberCount: sql<number>`(select count(*) from ${workspaceMemberships} where ${workspaceMemberships.workspaceId} = ${workspaces.id})::int`,
          accountCount: sql<number>`(select count(*) from ${socialAccounts} where ${socialAccounts.workspaceId} = ${workspaces.id})::int`,
        })
        .from(workspaces)
        .innerJoin(owners, eq(owners.id, workspaces.ownerUserId))
        .leftJoin(
          workspacePlanAssignments,
          eq(workspacePlanAssignments.workspaceId, workspaces.id),
        )
        .leftJoin(plans, eq(plans.id, workspacePlanAssignments.planId))
        .where(where)
        .orderBy(desc(workspaces.createdAt))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({
          total: sql<number>`count(*)::int`,
          teamKind: sql<number>`count(*) filter (where ${workspaces.kind} <> 'personal')::int`,
        })
        .from(workspaces)
        .innerJoin(owners, eq(owners.id, workspaces.ownerUserId))
        .where(where),
      this.database.db
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceMemberships),
      this.database.db
        .select({ count: sql<number>`count(*)::int` })
        .from(socialAccounts),
    ]);

    const summary = counted[0] ?? { total: 0, teamKind: 0 };
    const members = memberTotals[0]?.count ?? 0;
    const teams = await Promise.all(
      rows.map(async (row) => {
        const limits = await this.planAccess.limitsFor(row.id);
        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          kind: row.kind,
          ownerName: row.ownerName,
          ownerEmail: row.ownerEmail,
          planName: row.planName,
          enabledModules: await this.planAccess.modulesFor(row.id),
          availableModules: limits.enabledModules,
          memberCount: row.memberCount,
          accountCount: row.accountCount,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    );
    return {
      totals: {
        workspaces: summary.total,
        teamWorkspaces: summary.teamKind,
        averageMembers: summary.total
          ? Math.round((members / summary.total) * 10) / 10
          : 0,
        connectedAccounts: accountTotals[0]?.count ?? 0,
      },
      teams,
      total: summary.total,
    };
  }

  async updateTeamModules(id: string, input: unknown, actorUserId: string) {
    const parsedId = z.string().uuid().safeParse(id);
    const parsed = updateAdminTeamModulesSchema.safeParse(input);
    if (!parsedId.success || !parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    const limits = await this.planAccess.limitsFor(parsedId.data);
    if (
      parsed.data.enabledModules.some(
        (module) => !limits.enabledModules.includes(module),
      )
    ) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    const [updated] = await this.database.db
      .update(workspaces)
      .set({
        enabledModules: parsed.data.enabledModules,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, parsedId.data))
      .returning({ id: workspaces.id });
    if (!updated) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.NOT_FOUND);
    }
    await this.database.db.insert(apiAuditLogs).values({
      actorUserId,
      workspaceId: parsedId.data,
      event: 'admin.workspace_modules_updated',
      subjectType: 'workspace',
      subjectId: parsedId.data,
      metadata: { enabledModules: parsed.data.enabledModules },
    });
    return {
      id: updated.id,
      enabledModules: await this.planAccess.modulesFor(updated.id),
      availableModules: limits.enabledModules,
    };
  }
}
