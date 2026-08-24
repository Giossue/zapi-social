import { HttpStatus, Injectable } from '@nestjs/common';
import {
  channelCapability,
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
  fileAssets,
  plans,
  publishingPosts,
  socialAccounts,
  workspaces,
  workspaceInvitations,
  workspaceMemberships,
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
import { AppException } from '../platform/errors/app-exception';

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

  async moduleAccessFor(workspaceId: string): Promise<{
    enabledModules: PortalModuleKey[];
    planModules: PortalModuleKey[];
  }> {
    const [limits, workspace] = await Promise.all([
      this.limitsFor(workspaceId),
      this.database.db
        .select({ enabledModules: workspaces.enabledModules })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);
    const planModules = limits.enabledModules;
    if (!workspace) return { enabledModules: [], planModules };
    if (workspace.enabledModules === null) {
      return { enabledModules: planModules, planModules };
    }
    const parsed = portalModuleKeySchema
      .array()
      .safeParse(workspace.enabledModules);
    if (!parsed.success) return { enabledModules: [], planModules };
    return {
      enabledModules: planModules.filter((module) =>
        parsed.data.includes(module),
      ),
      planModules,
    };
  }

  async modulesFor(workspaceId: string): Promise<PortalModuleKey[]> {
    return (await this.moduleAccessFor(workspaceId)).enabledModules;
  }

  async aiCostFor(workspaceId: string, kind: AiRequestKind) {
    const limits = await this.limitsFor(workspaceId);
    return limits.aiActionCosts[kind];
  }

  async requireAiVideoDuration(workspaceId: string, durationSeconds: number) {
    const limits = await this.limitsFor(workspaceId);
    if (
      !isUnlimited(limits.aiVideoMaxSeconds) &&
      durationSeconds > limits.aiVideoMaxSeconds
    ) {
      throw this.limitReached('aiVideoMaxSeconds', limits.aiVideoMaxSeconds);
    }
  }

  async requireChannelSlot(workspaceId: string, capabilityKey: string) {
    const available = await this.availableChannelCapabilities(workspaceId, [
      capabilityKey,
    ]);
    if (!available.has(capabilityKey)) {
      const limits = await this.limitsFor(workspaceId);
      throw this.limitReached('maxChannels', limits.maxChannels);
    }
  }

  async availableChannelCapabilities(
    workspaceId: string,
    capabilityKeys: string[],
  ) {
    const limits = await this.limitsFor(workspaceId);
    if (isUnlimited(limits.maxChannels)) return new Set(capabilityKeys);
    if (limits.channelCountMode === 'total') {
      const [row] = await this.database.db
        .select({ count: sql<number>`count(*)::int` })
        .from(socialAccounts)
        .where(eq(socialAccounts.workspaceId, workspaceId));
      return (row?.count ?? 0) < limits.maxChannels
        ? new Set(capabilityKeys)
        : new Set<string>();
    }
    const counts = await this.database.db
      .select({
        count: sql<number>`count(*)::int`,
        providerKey: socialAccounts.providerKey,
      })
      .from(socialAccounts)
      .where(eq(socialAccounts.workspaceId, workspaceId))
      .groupBy(socialAccounts.providerKey);
    const countByProvider = new Map(
      counts.map((row) => [row.providerKey, row.count]),
    );
    return new Set(
      capabilityKeys.filter((capabilityKey) => {
        const providerKey = channelCapability(
          capabilityKey as Parameters<typeof channelCapability>[0],
        )?.providerKey;
        return (
          providerKey !== undefined &&
          (countByProvider.get(providerKey) ?? 0) < limits.maxChannels
        );
      }),
    );
  }

  async requirePostSlot(workspaceId: string, count = 1) {
    const limits = await this.limitsFor(workspaceId);
    if (isUnlimited(limits.maxPostsPerMonth)) return;
    const [row] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(publishingPosts)
      .where(
        and(
          eq(publishingPosts.workspaceId, workspaceId),
          sql`${publishingPosts.createdAt} >= date_trunc('month', now())`,
        ),
      );
    if ((row?.count ?? 0) + count > limits.maxPostsPerMonth) {
      throw this.limitReached('maxPostsPerMonth', limits.maxPostsPerMonth);
    }
  }

  async requireFileSize(workspaceId: string, sizeBytes: number) {
    const limits = await this.limitsFor(workspaceId);
    if (
      !isUnlimited(limits.maxFileSizeMb) &&
      sizeBytes > limits.maxFileSizeMb * 1024 * 1024
    ) {
      throw this.limitReached('maxFileSizeMb', limits.maxFileSizeMb);
    }
    if (isUnlimited(limits.maxStorageMb)) return;
    const [row] = await this.database.db
      .select({
        total: sql<number>`coalesce(sum(${fileAssets.sizeBytes}), 0)::bigint`,
      })
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.workspaceId, workspaceId),
          inArray(fileAssets.status, ['pending', 'ready']),
        ),
      );
    if (
      Number(row?.total ?? 0) + sizeBytes >
      limits.maxStorageMb * 1024 * 1024
    ) {
      throw this.limitReached('maxStorageMb', limits.maxStorageMb);
    }
  }

  async requireMemberSlot(workspaceId: string) {
    const limits = await this.limitsFor(workspaceId);
    if (isUnlimited(limits.maxTeamMembers)) return;
    const [row] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.status, 'active'),
        ),
      );
    if ((row?.count ?? 0) >= limits.maxTeamMembers) {
      throw this.limitReached('maxTeamMembers', limits.maxTeamMembers);
    }
  }

  async requireInvitationSlot(workspaceId: string) {
    const limits = await this.limitsFor(workspaceId);
    if (isUnlimited(limits.maxTeamMembers)) return;
    const [members, invitations] = await Promise.all([
      this.database.db
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, workspaceId),
            eq(workspaceMemberships.status, 'active'),
          ),
        ),
      this.database.db
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceInvitations)
        .where(
          and(
            eq(workspaceInvitations.workspaceId, workspaceId),
            eq(workspaceInvitations.status, 'pending'),
            gt(workspaceInvitations.expiresAt, new Date()),
          ),
        ),
    ]);
    if (
      (members[0]?.count ?? 0) + (invitations[0]?.count ?? 0) >=
      limits.maxTeamMembers
    ) {
      throw this.limitReached('maxTeamMembers', limits.maxTeamMembers);
    }
  }

  async requireModule(workspaceId: string, module: PortalModuleKey) {
    const enabledModules = await this.modulesFor(workspaceId);
    if (!enabledModules.includes(module)) {
      throw new AppException('PLAN_MODULE_DISABLED', HttpStatus.FORBIDDEN, {
        module,
      });
    }
  }

  private parseLimits(value: unknown): PlanLimits {
    const parsed = planLimitsSchema.safeParse(value ?? {});
    return parsed.success ? parsed.data : restrictivePlanLimits;
  }

  private limitReached(limit: keyof PlanLimits, value: number) {
    return new AppException('PLAN_LIMIT_REACHED', HttpStatus.FORBIDDEN, {
      limit,
      value,
    });
  }
}
