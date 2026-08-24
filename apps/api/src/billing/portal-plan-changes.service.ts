import { HttpStatus, Injectable } from '@nestjs/common';
import {
  schedulePortalPlanChangeSchema,
  type PortalAuthSession,
  type PortalPlanChangeState,
} from '@workspace/contracts';
import {
  billingSubscriptions,
  plans,
  workspacePlanAssignments,
} from '@workspace/database';
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
} from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { BillingPolarService } from './billing-polar.service';

@Injectable()
export class PortalPlanChangesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly polar: BillingPolarService,
  ) {}

  async state(session: PortalAuthSession): Promise<PortalPlanChangeState> {
    const assignment = await this.assignment(session.workspace.id);
    if (!assignment?.nextPlanId) {
      return { nextPlanId: null, effectiveAt: null };
    }
    const subscription = await this.currentSubscription(
      session.workspace.id,
      assignment.planId,
    );
    return {
      nextPlanId: assignment.nextPlanId,
      effectiveAt: subscription?.currentPeriodEndsAt?.toISOString() ?? null,
    };
  }

  async schedule(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalPlanChangeState> {
    this.requireOwner(session);
    const parsed = schedulePortalPlanChangeSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    const [target, assignment] = await Promise.all([
      this.database.db
        .select({ id: plans.id, isFree: plans.isFree })
        .from(plans)
        .where(
          and(eq(plans.id, parsed.data.planId), eq(plans.status, 'active')),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.assignment(session.workspace.id),
    ]);
    if (!target || !target.isFree) {
      throw new AppException(
        'BILLING_PLAN_CHANGE_UNAVAILABLE',
        HttpStatus.CONFLICT,
      );
    }
    if (assignment?.planId === target.id) {
      throw new AppException('BILLING_PLAN_CURRENT', HttpStatus.CONFLICT);
    }
    if (!assignment || assignment.source !== 'subscription') {
      throw new AppException(
        'BILLING_PLAN_CHANGE_UNAVAILABLE',
        HttpStatus.CONFLICT,
      );
    }
    const subscription = await this.activeSubscription(
      session.workspace.id,
      assignment.planId,
    );
    if (!subscription?.currentPeriodEndsAt) {
      throw new AppException(
        'BILLING_PLAN_CHANGE_UNAVAILABLE',
        HttpStatus.CONFLICT,
      );
    }
    if (assignment.nextPlanId === target.id) {
      return {
        nextPlanId: target.id,
        effectiveAt: subscription.currentPeriodEndsAt.toISOString(),
      };
    }

    let client: Awaited<ReturnType<BillingPolarService['client']>>;
    try {
      client = await this.polar.client();
      await client.subscriptions.update({
        id: subscription.externalSubscriptionId,
        subscriptionUpdate: { cancelAtPeriodEnd: true },
      });
    } catch {
      throw new AppException(
        'BILLING_PLAN_CHANGE_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(billingSubscriptions)
          .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
          .where(eq(billingSubscriptions.id, subscription.id));
        const updated = await tx
          .update(workspacePlanAssignments)
          .set({
            nextPlanId: target.id,
            updatedByUserId: session.user.id,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(workspacePlanAssignments.workspaceId, session.workspace.id),
              eq(workspacePlanAssignments.planId, assignment.planId),
            ),
          )
          .returning({ id: workspacePlanAssignments.id });
        if (!updated.length) throw new Error('Plan assignment changed');
      });
    } catch {
      await client.subscriptions
        .update({
          id: subscription.externalSubscriptionId,
          subscriptionUpdate: { cancelAtPeriodEnd: false },
        })
        .catch(() => undefined);
      throw new AppException(
        'BILLING_PLAN_CHANGE_UNAVAILABLE',
        HttpStatus.CONFLICT,
      );
    }

    return {
      nextPlanId: target.id,
      effectiveAt: subscription.currentPeriodEndsAt.toISOString(),
    };
  }

  async cancel(session: PortalAuthSession): Promise<void> {
    this.requireOwner(session);
    const assignment = await this.assignment(session.workspace.id);
    if (!assignment?.nextPlanId || assignment.source !== 'subscription') return;
    const subscription = await this.activeSubscription(
      session.workspace.id,
      assignment.planId,
    );
    if (!subscription) {
      throw new AppException(
        'BILLING_PLAN_CHANGE_UNAVAILABLE',
        HttpStatus.CONFLICT,
      );
    }

    let client: Awaited<ReturnType<BillingPolarService['client']>>;
    try {
      client = await this.polar.client();
      await client.subscriptions.update({
        id: subscription.externalSubscriptionId,
        subscriptionUpdate: { cancelAtPeriodEnd: false },
      });
    } catch {
      throw new AppException(
        'BILLING_PLAN_CHANGE_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(billingSubscriptions)
          .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
          .where(eq(billingSubscriptions.id, subscription.id));
        await tx
          .update(workspacePlanAssignments)
          .set({
            nextPlanId: null,
            updatedByUserId: session.user.id,
            updatedAt: new Date(),
          })
          .where(eq(workspacePlanAssignments.id, assignment.id));
      });
    } catch {
      await client.subscriptions
        .update({
          id: subscription.externalSubscriptionId,
          subscriptionUpdate: { cancelAtPeriodEnd: true },
        })
        .catch(() => undefined);
      throw new AppException(
        'BILLING_PLAN_CHANGE_UNAVAILABLE',
        HttpStatus.CONFLICT,
      );
    }
  }

  private assignment(workspaceId: string) {
    return this.database.db
      .select({
        id: workspacePlanAssignments.id,
        planId: workspacePlanAssignments.planId,
        nextPlanId: workspacePlanAssignments.nextPlanId,
        source: workspacePlanAssignments.source,
      })
      .from(workspacePlanAssignments)
      .where(eq(workspacePlanAssignments.workspaceId, workspaceId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  private activeSubscription(workspaceId: string, planId: string) {
    return this.database.db
      .select()
      .from(billingSubscriptions)
      .where(
        and(
          eq(billingSubscriptions.workspaceId, workspaceId),
          eq(billingSubscriptions.planId, planId),
          inArray(billingSubscriptions.status, ['active', 'trialing']),
          isNotNull(billingSubscriptions.currentPeriodEndsAt),
          gt(billingSubscriptions.currentPeriodEndsAt, new Date()),
        ),
      )
      .orderBy(desc(billingSubscriptions.updatedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  private currentSubscription(workspaceId: string, planId: string) {
    return this.database.db
      .select({ currentPeriodEndsAt: billingSubscriptions.currentPeriodEndsAt })
      .from(billingSubscriptions)
      .where(
        and(
          eq(billingSubscriptions.workspaceId, workspaceId),
          eq(billingSubscriptions.planId, planId),
        ),
      )
      .orderBy(desc(billingSubscriptions.updatedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  private requireOwner(session: PortalAuthSession) {
    if (session.workspace.role !== 'owner') {
      throw new AppException('BILLING_OWNER_REQUIRED', HttpStatus.FORBIDDEN);
    }
  }
}
