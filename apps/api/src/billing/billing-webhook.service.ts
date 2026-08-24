import {
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  validateEvent,
  WebhookVerificationError,
} from '@polar-sh/sdk/webhooks';
import {
  affiliateCommissions,
  affiliateProfiles,
  affiliateReferrals,
  billingCoupons,
  billingPayments,
  billingRefunds,
  billingSubscriptions,
  billingWebhookEvents,
  creditLedgerEntries,
  creditPackages,
  plans,
  workspaceCreditAccounts,
  workspacePlanAssignments,
} from '@workspace/database';
import { and, eq, sql } from '@workspace/database/query';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';
import { BillingPolarService } from './billing-polar.service';

const purchaseMetadataSchema = z
  .object({
    workspaceId: z.uuid(),
    userId: z.uuid(),
    productType: z.enum(['plan', 'credits']),
    planId: z.uuid().optional(),
    creditPackageId: z.uuid().optional(),
    productLabel: z.string().min(1).max(200),
    couponId: z.uuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.productType === 'plan' && !value.planId) {
      context.addIssue({
        code: 'custom',
        path: ['planId'],
        message: 'Missing plan',
      });
    }
    if (value.productType === 'credits' && !value.creditPackageId) {
      context.addIssue({
        code: 'custom',
        path: ['creditPackageId'],
        message: 'Missing package',
      });
    }
  });

const subscriptionMetadataSchema = z.object({
  workspaceId: z.uuid(),
  userId: z.uuid(),
  planId: z.uuid(),
});

type PolarEvent = ReturnType<typeof validateEvent>;
type PolarOrder = Extract<PolarEvent, { type: 'order.paid' }>['data'];
type PolarRefund = Extract<PolarEvent, { type: 'refund.updated' }>['data'];
type PolarSubscription = Extract<
  PolarEvent,
  { type: 'subscription.updated' }
>['data'];

@Injectable()
export class BillingWebhookService {
  constructor(
    private readonly database: DatabaseService,
    private readonly polar: BillingPolarService,
  ) {}

  async handle(rawBody: Buffer, headers: Record<string, string>) {
    const configuration = await this.polar.configuration();
    let event: ReturnType<typeof validateEvent>;
    try {
      event = validateEvent(rawBody, headers, configuration.webhookSecret);
    } catch (error) {
      if (error instanceof WebhookVerificationError)
        throw new ForbiddenException();
      throw new UnprocessableEntityException();
    }

    const externalEventId = headers['webhook-id'];
    if (!externalEventId) throw new ForbiddenException();
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    let [claimed] = await this.database.db
      .insert(billingWebhookEvents)
      .values({
        externalEventId,
        eventType: event.type,
        payloadHash,
      })
      .onConflictDoNothing({ target: billingWebhookEvents.externalEventId })
      .returning({ id: billingWebhookEvents.id });
    if (!claimed) {
      const [existing] = await this.database.db
        .select({
          id: billingWebhookEvents.id,
          payloadHash: billingWebhookEvents.payloadHash,
          status: billingWebhookEvents.status,
        })
        .from(billingWebhookEvents)
        .where(eq(billingWebhookEvents.externalEventId, externalEventId))
        .limit(1);
      if (!existing || existing.payloadHash !== payloadHash) {
        throw new ForbiddenException();
      }
      if (existing.status !== 'failed') return;
      [claimed] = await this.database.db
        .update(billingWebhookEvents)
        .set({ status: 'processing', errorCode: null, updatedAt: new Date() })
        .where(
          and(
            eq(billingWebhookEvents.id, existing.id),
            eq(billingWebhookEvents.status, 'failed'),
          ),
        )
        .returning({ id: billingWebhookEvents.id });
      if (!claimed) return;
    }

    try {
      switch (event.type) {
        case 'order.paid':
          await this.orderPaid(event.data);
          break;
        case 'order.refunded':
          await this.orderRefunded(event.data);
          break;
        case 'refund.created':
        case 'refund.updated':
          await this.refundUpdated(event.data);
          break;
        case 'subscription.created':
        case 'subscription.active':
        case 'subscription.updated':
        case 'subscription.past_due':
        case 'subscription.canceled':
        case 'subscription.uncanceled':
        case 'subscription.revoked':
          await this.subscriptionUpdated(event.data);
          break;
        default:
          break;
      }
      await this.database.db
        .update(billingWebhookEvents)
        .set({
          status: 'processed',
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(billingWebhookEvents.id, claimed.id));
    } catch {
      await this.database.db
        .update(billingWebhookEvents)
        .set({
          status: 'failed',
          errorCode: 'BILLING_EVENT_REJECTED',
          updatedAt: new Date(),
        })
        .where(eq(billingWebhookEvents.id, claimed.id));
      throw new UnprocessableEntityException();
    }
  }

  private async orderPaid(order: PolarOrder) {
    const metadata = purchaseMetadataSchema.parse(order.metadata);
    await this.database.db.transaction(async (tx) => {
      const subscriptionId = order.subscriptionId
        ? ((
            await tx
              .select({ id: billingSubscriptions.id })
              .from(billingSubscriptions)
              .where(
                eq(
                  billingSubscriptions.externalSubscriptionId,
                  order.subscriptionId,
                ),
              )
              .limit(1)
          )[0]?.id ?? null)
        : null;
      const [payment] = await tx
        .insert(billingPayments)
        .values({
          externalOrderId: order.id,
          externalCheckoutId: order.checkoutId,
          invoiceNumber: order.invoiceNumber,
          subscriptionId,
          workspaceId: metadata.workspaceId,
          userId: metadata.userId,
          planId: metadata.productType === 'plan' ? metadata.planId : null,
          creditPackageId:
            metadata.productType === 'credits'
              ? metadata.creditPackageId
              : null,
          productType: metadata.productType,
          productLabel: metadata.productLabel,
          status: 'paid',
          amountMinor: order.totalAmount,
          refundedAmountMinor: order.refundedAmount,
          currency: order.currency.toUpperCase(),
          paidAt: new Date(),
          metadata: { polarProductId: order.productId },
        })
        .onConflictDoNothing({ target: billingPayments.externalOrderId })
        .returning({ id: billingPayments.id });
      if (!payment) return;

      if (metadata.productType === 'plan' && metadata.planId) {
        await tx
          .insert(workspacePlanAssignments)
          .values({
            workspaceId: metadata.workspaceId,
            planId: metadata.planId,
            source: 'subscription',
          })
          .onConflictDoUpdate({
            target: workspacePlanAssignments.workspaceId,
            set: {
              planId: metadata.planId,
              source: 'subscription',
              updatedAt: new Date(),
            },
          });
      }

      if (metadata.productType === 'credits' && metadata.creditPackageId) {
        const [pack] = await tx
          .select({ units: creditPackages.units, name: creditPackages.name })
          .from(creditPackages)
          .where(eq(creditPackages.id, metadata.creditPackageId))
          .limit(1);
        if (!pack) throw new Error('Credit package not found');
        await tx
          .insert(workspaceCreditAccounts)
          .values({
            workspaceId: metadata.workspaceId,
            balanceUnits: pack.units,
          })
          .onConflictDoUpdate({
            target: workspaceCreditAccounts.workspaceId,
            set: {
              balanceUnits: sql`${workspaceCreditAccounts.balanceUnits} + ${pack.units}`,
              updatedAt: new Date(),
            },
          });
        await tx.insert(creditLedgerEntries).values({
          workspaceId: metadata.workspaceId,
          actorUserId: metadata.userId,
          type: 'grant',
          action: 'credits.purchase',
          units: pack.units,
          idempotencyKey: `polar-order-${order.id}`,
          metadata: {
            packageId: metadata.creditPackageId,
            packageName: pack.name,
            paymentId: payment.id,
          },
        });
      }

      if (metadata.couponId) {
        await tx
          .update(billingCoupons)
          .set({
            redemptionCount: sql`${billingCoupons.redemptionCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(billingCoupons.id, metadata.couponId));
      }

      const [referral] = await tx
        .select({
          id: affiliateReferrals.id,
          profileId: affiliateReferrals.affiliateProfileId,
          rate: affiliateProfiles.commissionRateBps,
          currency: affiliateProfiles.payoutCurrency,
        })
        .from(affiliateReferrals)
        .innerJoin(
          affiliateProfiles,
          eq(affiliateProfiles.id, affiliateReferrals.affiliateProfileId),
        )
        .where(
          and(
            eq(affiliateReferrals.referredUserId, metadata.userId),
            eq(affiliateProfiles.status, 'active'),
          ),
        )
        .limit(1);
      if (referral) {
        const commission = Math.floor(
          (order.totalAmount * referral.rate) / 10_000,
        );
        if (commission > 0) {
          await tx
            .insert(affiliateCommissions)
            .values({
              affiliateProfileId: referral.profileId,
              referralId: referral.id,
              externalReference: `polar-order:${order.id}`,
              amountMinor: commission,
              currency: referral.currency,
              eligibleAt: new Date(Date.now() + 30 * 86_400_000),
            })
            .onConflictDoNothing({
              target: affiliateCommissions.externalReference,
            });
          await tx
            .update(affiliateReferrals)
            .set({
              status: 'converted',
              convertedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(affiliateReferrals.id, referral.id));
        }
      }
    });
  }

  private async orderRefunded(order: PolarOrder) {
    await this.database.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(billingPayments)
        .where(eq(billingPayments.externalOrderId, order.id))
        .limit(1);
      if (!payment) return;
      const fullyRefunded = order.refundedAmount >= payment.amountMinor;
      const wasFullyRefunded = payment.status === 'refunded';
      await tx
        .update(billingPayments)
        .set({
          refundedAmountMinor: order.refundedAmount,
          status: fullyRefunded ? 'refunded' : 'partially_refunded',
          updatedAt: new Date(),
        })
        .where(eq(billingPayments.id, payment.id));
      if (!fullyRefunded || wasFullyRefunded) return;

      await tx
        .update(affiliateCommissions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(
          and(
            eq(
              affiliateCommissions.externalReference,
              `polar-order:${order.id}`,
            ),
            sql`${affiliateCommissions.status} <> 'paid'`,
          ),
        );

      if (payment.productType === 'credits' && payment.creditPackageId) {
        const [pack] = await tx
          .select({ units: creditPackages.units, name: creditPackages.name })
          .from(creditPackages)
          .where(eq(creditPackages.id, payment.creditPackageId))
          .limit(1);
        const [account] = await tx
          .select({ balance: workspaceCreditAccounts.balanceUnits })
          .from(workspaceCreditAccounts)
          .where(eq(workspaceCreditAccounts.workspaceId, payment.workspaceId))
          .limit(1);
        const units = Math.min(pack?.units ?? 0, account?.balance ?? 0);
        if (units > 0) {
          await tx
            .update(workspaceCreditAccounts)
            .set({
              balanceUnits: sql`${workspaceCreditAccounts.balanceUnits} - ${units}`,
              updatedAt: new Date(),
            })
            .where(
              eq(workspaceCreditAccounts.workspaceId, payment.workspaceId),
            );
          await tx.insert(creditLedgerEntries).values({
            workspaceId: payment.workspaceId,
            actorUserId: payment.userId,
            type: 'adjustment',
            action: 'credits.purchase_refunded',
            units: -units,
            idempotencyKey: `polar-refund-order-${order.id}`,
            metadata: {
              packageId: payment.creditPackageId,
              packageName: pack?.name,
              paymentId: payment.id,
            },
          });
        }
      }

      if (payment.productType === 'plan') {
        const [defaultPlan] = await tx
          .select({ id: plans.id })
          .from(plans)
          .where(
            and(eq(plans.isDefaultSignup, true), eq(plans.status, 'active')),
          )
          .limit(1);
        if (defaultPlan) {
          await tx
            .update(workspacePlanAssignments)
            .set({
              planId: defaultPlan.id,
              source: 'admin',
              updatedAt: new Date(),
            })
            .where(
              eq(workspacePlanAssignments.workspaceId, payment.workspaceId),
            );
        }
      }
    });
  }

  private async refundUpdated(refund: PolarRefund) {
    const status =
      refund.status === 'succeeded'
        ? 'succeeded'
        : refund.status === 'failed'
          ? 'failed'
          : refund.status === 'canceled'
            ? 'canceled'
            : 'pending';
    await this.database.db
      .update(billingRefunds)
      .set({ status, updatedAt: new Date() })
      .where(eq(billingRefunds.externalRefundId, refund.id));
  }

  private async subscriptionUpdated(subscription: PolarSubscription) {
    const metadata = subscriptionMetadataSchema.parse(subscription.metadata);
    const status = this.subscriptionState(String(subscription.status));
    await this.database.db.transaction(async (tx) => {
      await tx
        .insert(billingSubscriptions)
        .values({
          externalSubscriptionId: subscription.id,
          externalCustomerId: subscription.customerId,
          externalProductId: subscription.productId,
          workspaceId: metadata.workspaceId,
          userId: metadata.userId,
          planId: metadata.planId,
          status,
          amountMinor: subscription.amount,
          currency: subscription.currency.toUpperCase(),
          interval:
            subscription.recurringInterval === 'year' ? 'year' : 'month',
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodStartsAt: subscription.currentPeriodStart,
          currentPeriodEndsAt: subscription.currentPeriodEnd,
          canceledAt: subscription.canceledAt,
          endedAt: subscription.endedAt,
          metadata: { polarCheckoutId: subscription.checkoutId },
        })
        .onConflictDoUpdate({
          target: billingSubscriptions.externalSubscriptionId,
          set: {
            status,
            amountMinor: subscription.amount,
            currency: subscription.currency.toUpperCase(),
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            currentPeriodStartsAt: subscription.currentPeriodStart,
            currentPeriodEndsAt: subscription.currentPeriodEnd,
            canceledAt: subscription.canceledAt,
            endedAt: subscription.endedAt,
            updatedAt: new Date(),
          },
        });
      if (status === 'active' || status === 'trialing') {
        await tx
          .insert(workspacePlanAssignments)
          .values({
            workspaceId: metadata.workspaceId,
            planId: metadata.planId,
            source: 'subscription',
          })
          .onConflictDoUpdate({
            target: workspacePlanAssignments.workspaceId,
            set: {
              planId: metadata.planId,
              source: 'subscription',
              updatedAt: new Date(),
            },
          });
      }
    });
  }

  private subscriptionState(value: string) {
    if (
      value === 'incomplete' ||
      value === 'trialing' ||
      value === 'active' ||
      value === 'past_due' ||
      value === 'paused' ||
      value === 'canceled' ||
      value === 'unpaid'
    ) {
      return value;
    }
    throw new Error('Unsupported subscription status');
  }
}
