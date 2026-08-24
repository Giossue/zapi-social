import { Injectable } from '@nestjs/common';
import {
  isUnlimited,
  planLimitsSchema,
  portalModuleKeySchema,
  restrictivePlanLimits,
  type AiRequestKind,
  type PlanLimits,
  type PortalModuleKey,
} from '@workspace/contracts';
import {
  billingSubscriptions,
  plans,
  publishingPosts,
  workspaces,
  workspacePlanAssignments,
} from '@workspace/database';
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  or,
  sql,
} from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PlanAccessService {
  constructor(private readonly database: DatabaseService) {}

  async limitsFor(workspaceId: string): Promise<PlanLimits> {
    const [assigned] = await this.database.db
      .select({
        limits: plans.limits,
        planId: plans.id,
        source: workspacePlanAssignments.source,
        status: plans.status,
      })
      .from(workspacePlanAssignments)
      .innerJoin(plans, eq(plans.id, workspacePlanAssignments.planId))
      .where(eq(workspacePlanAssignments.workspaceId, workspaceId))
      .limit(1);
    if (assigned && assigned.status === 'active') {
      if (assigned.source !== 'subscription') {
        return this.parseLimits(assigned.limits);
      }
      const [subscription] = await this.database.db
        .select({ id: billingSubscriptions.id })
        .from(billingSubscriptions)
        .where(
          and(
            eq(billingSubscriptions.workspaceId, workspaceId),
            eq(billingSubscriptions.planId, assigned.planId),
            inArray(billingSubscriptions.status, ['active', 'trialing']),
            or(
              isNull(billingSubscriptions.currentPeriodEndsAt),
              gt(billingSubscriptions.currentPeriodEndsAt, new Date()),
            ),
          ),
        )
        .orderBy(desc(billingSubscriptions.updatedAt))
        .limit(1);
      if (subscription) return this.parseLimits(assigned.limits);
    }
    const [fallback] = await this.database.db
      .select({ limits: plans.limits })
      .from(plans)
      .where(and(eq(plans.isDefaultSignup, true), eq(plans.status, 'active')))
      .limit(1);
    return fallback ? this.parseLimits(fallback.limits) : restrictivePlanLimits;
  }

  async modulesFor(workspaceId: string): Promise<PortalModuleKey[]> {
    const [limits, workspace] = await Promise.all([
      this.limitsFor(workspaceId),
      this.database.db
        .select({ enabledModules: workspaces.enabledModules })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);
    if (!workspace) return [];
    if (workspace.enabledModules === null) return limits.enabledModules;
    const parsed = portalModuleKeySchema
      .array()
      .safeParse(workspace.enabledModules);
    if (!parsed.success) return [];
    return limits.enabledModules.filter((module) =>
      parsed.data.includes(module),
    );
  }

  async moduleAvailable(workspaceId: string, module: PortalModuleKey) {
    return (await this.modulesFor(workspaceId)).includes(module);
  }

  async aiCostFor(workspaceId: string, kind: AiRequestKind) {
    const limits = await this.limitsFor(workspaceId);
    return limits.aiActionCosts[kind];
  }

  async postSlotAvailable(workspaceId: string, count = 1): Promise<boolean> {
    const limits = await this.limitsFor(workspaceId);
    if (isUnlimited(limits.maxPostsPerMonth)) return true;
    const [row] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(publishingPosts)
      .where(
        and(
          eq(publishingPosts.workspaceId, workspaceId),
          sql`${publishingPosts.createdAt} >= date_trunc('month', now())`,
        ),
      );
    return (row?.count ?? 0) + count <= limits.maxPostsPerMonth;
  }

  private parseLimits(value: unknown): PlanLimits {
    const parsed = planLimitsSchema.safeParse(value ?? {});
    return parsed.success ? parsed.data : restrictivePlanLimits;
  }
}
