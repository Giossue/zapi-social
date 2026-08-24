import { HttpStatus, Injectable } from '@nestjs/common';
import {
  createPortalPlanCheckoutSchema,
  planLimitsFrom,
  type PortalAuthSession,
  type PortalBillingSubscription,
  type PortalPlan,
  type PortalPlanCheckoutResponse,
  type PortalPlansResponse,
} from '@workspace/contracts';
import {
  billingSubscriptions,
  plans,
  workspacePlanAssignments,
} from '@workspace/database';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  or,
} from '@workspace/database/query';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { BillingPolarService } from './billing-polar.service';

type CurrentPlanSource = 'signup' | 'admin' | 'subscription' | 'fallback';

@Injectable()
export class PortalBillingService {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly polar: BillingPolarService,
  ) {}

  async plans(session: PortalAuthSession): Promise<PortalPlansResponse> {
    const [planRows, current, integration] = await Promise.all([
      this.database.db
        .select()
        .from(plans)
        .where(eq(plans.status, 'active'))
        .orderBy(asc(plans.position), asc(plans.createdAt)),
      this.currentPlan(session.workspace.id),
      this.polar.get(),
    ]);
    const subscription =
      current?.source === 'subscription'
        ? await this.activeSubscription(session.workspace.id, current.planId)
        : null;

    return {
      plans: planRows.map((plan) => this.serializePlan(plan)),
      currentPlanId: current?.planId ?? null,
      currentPlanSource: current?.source ?? null,
      subscription: subscription
        ? this.serializeSubscription(subscription)
        : null,
      checkoutAvailable:
        integration.enabled &&
        integration.readiness === 'ready' &&
        integration.recurring,
      canManageBilling: session.workspace.role === 'owner',
    };
  }

  async checkout(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalPlanCheckoutResponse> {
    const parsed = createPortalPlanCheckoutSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    if (session.workspace.role !== 'owner') {
      throw new AppException('BILLING_OWNER_REQUIRED', HttpStatus.FORBIDDEN);
    }

    const [plan] = await this.database.db
      .select()
      .from(plans)
      .where(and(eq(plans.id, parsed.data.planId), eq(plans.status, 'active')))
      .limit(1);
    if (!plan || plan.isFree || Number(plan.price) <= 0) {
      throw new AppException('BILLING_PLAN_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const [current, activeSubscription] = await Promise.all([
      this.currentPlan(session.workspace.id),
      this.activeSubscription(session.workspace.id),
    ]);
    if (current?.planId === plan.id) {
      throw new AppException('BILLING_PLAN_CURRENT', HttpStatus.CONFLICT);
    }
    if (activeSubscription) {
      throw new AppException(
        'BILLING_PLAN_CHANGE_UNAVAILABLE',
        HttpStatus.CONFLICT,
      );
    }

    const priceMinor = Math.round(Number(plan.price) * 100);
    if (priceMinor < 50) {
      throw new AppException(
        'BILLING_CHECKOUT_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const configuration = await this.polar.configuration();
      if (!configuration.recurring) {
        throw new Error('Recurring checkout is disabled');
      }
      const productId =
        plan.billingType === 'yearly'
          ? configuration.yearlyProductId
          : configuration.monthlyProductId;
      if (!productId) throw new Error('Polar product is missing');

      const webOrigin = this.config.getOrThrow<string>('WEB_ORIGIN');
      const client = await this.polar.client();
      const checkout = await client.checkouts.create({
        products: [productId],
        prices: {
          [productId]: [
            {
              amountType: 'fixed',
              priceAmount: priceMinor,
              priceCurrency: 'usd',
            },
          ],
        },
        metadata: {
          workspaceId: session.workspace.id,
          userId: session.user.id,
          productType: 'plan',
          planId: plan.id,
          productLabel: plan.name,
        },
        customerEmail: session.user.email,
        customerName: session.user.displayName,
        externalCustomerId: session.user.id,
        allowDiscountCodes: configuration.discountCodes,
        requireBillingAddress: configuration.billingAddress,
        allowTrial: plan.trialDays > 0,
        trialInterval: plan.trialDays > 0 ? 'day' : undefined,
        trialIntervalCount: plan.trialDays > 0 ? plan.trialDays : undefined,
        locale: session.user.locale ?? 'es',
        successUrl: `${new URL('/portal/billing/success', webOrigin)}?checkout_id={CHECKOUT_ID}`,
        returnUrl: new URL('/portal/billing/cancel', webOrigin).toString(),
      });

      return { checkoutUrl: checkout.url };
    } catch {
      throw new AppException(
        'BILLING_CHECKOUT_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async currentPlan(workspaceId: string) {
    const [assigned] = await this.database.db
      .select({
        planId: plans.id,
        source: workspacePlanAssignments.source,
        status: plans.status,
      })
      .from(workspacePlanAssignments)
      .innerJoin(plans, eq(plans.id, workspacePlanAssignments.planId))
      .where(eq(workspacePlanAssignments.workspaceId, workspaceId))
      .limit(1);

    if (assigned?.status === 'active') {
      if (assigned.source !== 'subscription') {
        return {
          planId: assigned.planId,
          source: assigned.source as CurrentPlanSource,
        };
      }
      const active = await this.activeSubscription(
        workspaceId,
        assigned.planId,
      );
      if (active) {
        return { planId: assigned.planId, source: 'subscription' as const };
      }
    }

    const [fallback] = await this.database.db
      .select({ planId: plans.id })
      .from(plans)
      .where(and(eq(plans.isDefaultSignup, true), eq(plans.status, 'active')))
      .limit(1);
    return fallback
      ? { planId: fallback.planId, source: 'fallback' as const }
      : null;
  }

  private activeSubscription(workspaceId: string, planId?: string) {
    return this.database.db
      .select()
      .from(billingSubscriptions)
      .where(
        and(
          eq(billingSubscriptions.workspaceId, workspaceId),
          planId ? eq(billingSubscriptions.planId, planId) : undefined,
          inArray(billingSubscriptions.status, ['active', 'trialing']),
          or(
            isNull(billingSubscriptions.currentPeriodEndsAt),
            gt(billingSubscriptions.currentPeriodEndsAt, new Date()),
          ),
        ),
      )
      .orderBy(desc(billingSubscriptions.updatedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  private serializePlan(plan: typeof plans.$inferSelect): PortalPlan {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      featured: plan.featured,
      currency: 'USD',
      priceMinor: Math.round(Number(plan.price) * 100),
      billingType: plan.billingType,
      isFree: plan.isFree,
      isDefaultSignup: plan.isDefaultSignup,
      trialDays: plan.trialDays,
      position: plan.position,
      limits: planLimitsFrom(plan.limits),
    };
  }

  private serializeSubscription(
    subscription: typeof billingSubscriptions.$inferSelect,
  ): PortalBillingSubscription {
    return {
      status: subscription.status,
      interval: subscription.interval,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEndsAt:
        subscription.currentPeriodEndsAt?.toISOString() ?? null,
    };
  }
}
