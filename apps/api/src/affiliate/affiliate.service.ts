import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  affiliateCommissions,
  affiliateProfiles,
  affiliateReferrals,
  affiliateReferralVisits,
  affiliateWithdrawals,
  apiAuditLogs,
} from '@workspace/database';
import { and, desc, eq, inArray, sql } from '@workspace/database/query';
import {
  captureAffiliateReferralSchema,
  requestPortalAffiliateWithdrawalSchema,
  type PortalAffiliateDashboard,
  type PortalAuthSession,
} from '@workspace/contracts';
import type { FastifyRequest } from 'fastify';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

@Injectable()
export class AffiliateService {
  constructor(private readonly database: DatabaseService) {}

  async dashboard(
    session: PortalAuthSession,
  ): Promise<PortalAffiliateDashboard> {
    const [profile] = await this.database.db
      .select()
      .from(affiliateProfiles)
      .where(eq(affiliateProfiles.userId, session.user.id))
      .limit(1);
    if (!profile) return this.emptyDashboard();
    await this.database.db
      .update(affiliateCommissions)
      .set({ status: 'available', updatedAt: new Date() })
      .where(
        and(
          eq(affiliateCommissions.affiliateProfileId, profile.id),
          eq(affiliateCommissions.status, 'pending'),
          sql`${affiliateCommissions.eligibleAt} <= now()`,
        ),
      );
    const [
      visits,
      referrals,
      conversions,
      commissionTotals,
      withdrawalTotals,
      commissions,
      withdrawals,
    ] = await Promise.all([
      this.countVisits(profile.id),
      this.countReferrals(profile.id),
      this.countConversions(profile.id),
      this.database.db
        .select({
          availableMinor: sql<number>`coalesce(sum(${affiliateCommissions.amountMinor}) filter (where ${affiliateCommissions.status} = 'available'), 0)::int`,
          paidMinor: sql<number>`coalesce(sum(${affiliateCommissions.amountMinor}) filter (where ${affiliateCommissions.status} = 'paid'), 0)::int`,
          pendingMinor: sql<number>`coalesce(sum(${affiliateCommissions.amountMinor}) filter (where ${affiliateCommissions.status} = 'pending'), 0)::int`,
        })
        .from(affiliateCommissions)
        .where(
          and(
            eq(affiliateCommissions.affiliateProfileId, profile.id),
            eq(affiliateCommissions.currency, profile.payoutCurrency),
          ),
        ),
      this.database.db
        .select({
          reservedMinor: sql<number>`coalesce(sum(${affiliateWithdrawals.amountMinor}) filter (where ${affiliateWithdrawals.status} in ('requested', 'approved')), 0)::int`,
          paidMinor: sql<number>`coalesce(sum(${affiliateWithdrawals.amountMinor}) filter (where ${affiliateWithdrawals.status} = 'paid'), 0)::int`,
        })
        .from(affiliateWithdrawals)
        .where(
          and(
            eq(affiliateWithdrawals.affiliateProfileId, profile.id),
            eq(affiliateWithdrawals.currency, profile.payoutCurrency),
          ),
        ),
      this.database.db
        .select()
        .from(affiliateCommissions)
        .where(eq(affiliateCommissions.affiliateProfileId, profile.id))
        .orderBy(desc(affiliateCommissions.createdAt))
        .limit(100),
      this.database.db
        .select()
        .from(affiliateWithdrawals)
        .where(eq(affiliateWithdrawals.affiliateProfileId, profile.id))
        .orderBy(desc(affiliateWithdrawals.createdAt))
        .limit(100),
    ]);
    const totals = commissionTotals[0];
    const withdrawalAmounts = withdrawalTotals[0];
    return {
      profile: {
        id: profile.id,
        code: profile.code,
        status: profile.status,
        commissionRateBps: profile.commissionRateBps,
        payoutCurrency: profile.payoutCurrency,
        createdAt: profile.createdAt.toISOString(),
      },
      totals: {
        visits,
        referrals,
        conversions,
        pendingMinor: totals?.pendingMinor ?? 0,
        availableMinor: Math.max(
          0,
          (totals?.availableMinor ?? 0) -
            (withdrawalAmounts?.reservedMinor ?? 0) -
            (withdrawalAmounts?.paidMinor ?? 0),
        ),
        paidMinor: withdrawalAmounts?.paidMinor ?? totals?.paidMinor ?? 0,
        currency: profile.payoutCurrency,
      },
      commissions: commissions.map((commission) => ({
        id: commission.id,
        status: commission.status,
        amountMinor: commission.amountMinor,
        currency: commission.currency,
        createdAt: commission.createdAt.toISOString(),
      })),
      withdrawals: withdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        status: withdrawal.status,
        amountMinor: withdrawal.amountMinor,
        currency: withdrawal.currency,
        createdAt: withdrawal.createdAt.toISOString(),
      })),
    };
  }

  async activate(session: PortalAuthSession) {
    const [existing] = await this.database.db
      .select()
      .from(affiliateProfiles)
      .where(eq(affiliateProfiles.userId, session.user.id))
      .limit(1);
    if (existing) return (await this.dashboard(session)).profile;
    const code = `zapi-${randomBytes(9).toString('base64url').toLowerCase()}`;
    const [profile] = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(affiliateProfiles)
        .values({ userId: session.user.id, code })
        .returning();
      if (!created) throw this.failed();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'affiliate.profile_activated',
        subjectType: 'affiliate_profile',
        subjectId: created.id,
        metadata: {},
      });
      return [created];
    });
    if (!profile) throw this.failed();
    return (await this.dashboard(session)).profile;
  }

  async requestWithdrawal(session: PortalAuthSession, input: unknown) {
    const parsed = requestPortalAffiliateWithdrawalSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const now = new Date();
    return this.database.db.transaction(async (tx) => {
      const [profile] = await tx
        .select()
        .from(affiliateProfiles)
        .where(eq(affiliateProfiles.userId, session.user.id))
        .for('update')
        .limit(1);
      if (!profile || profile.status !== 'active') throw this.notAvailable();
      const [available, reserved] = await Promise.all([
        tx
          .select({
            value: sql<number>`coalesce(sum(${affiliateCommissions.amountMinor}), 0)::int`,
          })
          .from(affiliateCommissions)
          .where(
            and(
              eq(affiliateCommissions.affiliateProfileId, profile.id),
              eq(affiliateCommissions.status, 'available'),
              eq(affiliateCommissions.currency, profile.payoutCurrency),
            ),
          ),
        tx
          .select({
            value: sql<number>`coalesce(sum(${affiliateWithdrawals.amountMinor}), 0)::int`,
          })
          .from(affiliateWithdrawals)
          .where(
            and(
              eq(affiliateWithdrawals.affiliateProfileId, profile.id),
              inArray(affiliateWithdrawals.status, [
                'requested',
                'approved',
                'paid',
              ]),
              eq(affiliateWithdrawals.currency, profile.payoutCurrency),
            ),
          ),
      ]);
      const withdrawable =
        (available[0]?.value ?? 0) - (reserved[0]?.value ?? 0);
      if (parsed.data.amountMinor > withdrawable) {
        throw new AppException(
          'AFFILIATE_BALANCE_INSUFFICIENT',
          HttpStatus.CONFLICT,
        );
      }
      const [withdrawal] = await tx
        .insert(affiliateWithdrawals)
        .values({
          affiliateProfileId: profile.id,
          requestedByUserId: session.user.id,
          amountMinor: parsed.data.amountMinor,
          currency: profile.payoutCurrency,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!withdrawal) throw this.failed();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'affiliate.withdrawal_requested',
        subjectType: 'affiliate_withdrawal',
        subjectId: withdrawal.id,
        metadata: {
          amountMinor: withdrawal.amountMinor,
          currency: withdrawal.currency,
        },
      });
      return {
        id: withdrawal.id,
        status: withdrawal.status,
        amountMinor: withdrawal.amountMinor,
        currency: withdrawal.currency,
        createdAt: withdrawal.createdAt.toISOString(),
      };
    });
  }

  async capture(request: FastifyRequest, input: unknown) {
    const parsed = captureAffiliateReferralSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const [profile] = await this.database.db
      .select()
      .from(affiliateProfiles)
      .where(
        and(
          eq(affiliateProfiles.code, parsed.data.code),
          eq(affiliateProfiles.status, 'active'),
        ),
      )
      .limit(1);
    if (!profile) throw this.notAvailable();
    const userAgent = headerValue(request.headers['user-agent'])?.slice(
      0,
      1000,
    );
    const referrer = headerValue(request.headers.referer)?.slice(0, 1000);
    const fingerprintHash = createHash('sha256')
      .update(
        `${request.ip}\u0000${userAgent ?? ''}\u0000${new Date().toISOString().slice(0, 10)}`,
      )
      .digest('hex');
    const [referral] = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(affiliateReferrals)
        .values({
          affiliateProfileId: profile.id,
          source: parsed.data.source ?? null,
          landingPath: parsed.data.landingPath ?? null,
        })
        .returning({ id: affiliateReferrals.id });
      if (!created) throw this.failed();
      await tx.insert(affiliateReferralVisits).values({
        affiliateProfileId: profile.id,
        referralId: created.id,
        fingerprintHash,
        referrer: referrer ?? null,
        userAgent: userAgent ?? null,
      });
      return [created];
    });
    if (!referral) throw this.failed();
    return { referralId: referral.id };
  }

  private emptyDashboard(): PortalAffiliateDashboard {
    return {
      profile: null,
      totals: {
        visits: 0,
        referrals: 0,
        conversions: 0,
        pendingMinor: 0,
        availableMinor: 0,
        paidMinor: 0,
        currency: 'USD',
      },
      commissions: [],
      withdrawals: [],
    };
  }
  private async countVisits(profileId: string) {
    const [row] = await this.database.db
      .select({ value: sql<number>`count(*)::int` })
      .from(affiliateReferralVisits)
      .where(eq(affiliateReferralVisits.affiliateProfileId, profileId));
    return row?.value ?? 0;
  }
  private async countReferrals(profileId: string) {
    const [row] = await this.database.db
      .select({ value: sql<number>`count(*)::int` })
      .from(affiliateReferrals)
      .where(eq(affiliateReferrals.affiliateProfileId, profileId));
    return row?.value ?? 0;
  }
  private async countConversions(profileId: string) {
    const [row] = await this.database.db
      .select({ value: sql<number>`count(*)::int` })
      .from(affiliateReferrals)
      .where(
        and(
          eq(affiliateReferrals.affiliateProfileId, profileId),
          eq(affiliateReferrals.status, 'converted'),
        ),
      );
    return row?.value ?? 0;
  }
  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }
  private notAvailable() {
    return new AppException('AFFILIATE_NOT_AVAILABLE', HttpStatus.NOT_FOUND);
  }
  private failed() {
    return new AppException(
      'AFFILIATE_REQUEST_FAILED',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
