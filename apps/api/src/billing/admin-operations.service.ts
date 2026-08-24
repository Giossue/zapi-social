import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  adminOperationModuleSchema,
  adminOperationQuerySchema,
  createAdminOperationResourceSchema,
  runAdminOperationActionSchema,
  type AdminOperationActionKey,
  type AdminOperationModule,
  type AdminOperationQuery,
  type AdminOperationView,
  type AuthSession,
} from '@workspace/contracts';
import {
  affiliateCommissions,
  affiliateProfiles,
  affiliateReferralVisits,
  affiliateReferrals,
  affiliateWithdrawals,
  billingCoupons,
  billingPayments,
  billingRefunds,
  billingSubscriptions,
  creditLedgerEntries,
  creditPackages,
  plans,
  users,
  workspaceCreditAccounts,
  workspaceMemberships,
  workspacePlanAssignments,
  workspaces,
} from '@workspace/database';
import { and, asc, desc, eq, sql } from '@workspace/database/query';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';
import { PasswordResetService } from '../identity/password-reset.service';
import { BillingPolarService } from './billing-polar.service';

type Row = AdminOperationView['rows'][number];
type Cell = Row['cells'][number];
type Metric = AdminOperationView['metrics'][number];

@Injectable()
export class AdminOperationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly passwordReset: PasswordResetService,
    private readonly polar: BillingPolarService,
  ) {}

  async view(
    moduleInput: string,
    queryInput: unknown,
  ): Promise<AdminOperationView> {
    const module = this.parseModule(moduleInput);
    const query = this.parseQuery(queryInput);
    switch (module) {
      case 'users':
        return this.usersView(query);
      case 'credits':
        return this.creditsView(query);
      case 'affiliate':
        return this.affiliateView(query);
      case 'coupons':
        return this.couponsView(query);
      case 'payments':
        return this.paymentsView(query);
      case 'subscriptions':
        return this.subscriptionsView(query);
    }
  }

  async create(session: AuthSession, moduleInput: string, input: unknown) {
    const module = this.parseModule(moduleInput);
    const parsed = createAdminOperationResourceSchema.safeParse(input);
    if (!parsed.success || parsed.data.values.some((value) => !value)) {
      throw new BadRequestException();
    }
    const values = parsed.data.values;
    if (module === 'users') await this.createUser(session, values);
    else if (module === 'credits')
      await this.createCreditPackage(session, values);
    else if (module === 'coupons') await this.createCoupon(session, values);
    else throw new BadRequestException('Resource cannot be created here');
    return { success: true as const, messageKey: 'changesSaved' };
  }

  async action(
    session: AuthSession,
    moduleInput: string,
    tab: string,
    id: string,
    input: unknown,
  ) {
    const module = this.parseModule(moduleInput);
    const parsedId = z.uuid().safeParse(id);
    if (!parsedId.success) throw new BadRequestException();
    id = parsedId.data;
    const parsed = runAdminOperationActionSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException();
    const action = parsed.data.action;

    if (action === 'view') {
      return { success: true as const, messageKey: 'detailInRow' };
    }
    if (module === 'users')
      await this.userAction(session, id, action, parsed.data.values);
    else if (module === 'credits')
      await this.creditAction(session, tab, id, action, parsed.data.values);
    else if (module === 'affiliate')
      await this.affiliateAction(session, tab, id, action);
    else if (module === 'coupons')
      await this.couponAction(session, id, action, parsed.data.values);
    else if (module === 'payments')
      await this.paymentAction(session, id, action);
    else if (module === 'subscriptions')
      await this.subscriptionAction(session, id, action);
    return { success: true as const, messageKey: 'actionApplied' };
  }

  private async usersView(query: AdminOperationQuery) {
    const records = await this.database.db
      .select({
        id: users.id,
        name: users.displayName,
        email: users.email,
        status: users.status,
        createdAt: users.createdAt,
        workspaceName: workspaces.name,
        role: workspaceMemberships.role,
        planName: plans.name,
      })
      .from(users)
      .leftJoin(workspaceMemberships, eq(workspaceMemberships.userId, users.id))
      .leftJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
      .leftJoin(
        workspacePlanAssignments,
        eq(workspacePlanAssignments.workspaceId, workspaces.id),
      )
      .leftJoin(plans, eq(plans.id, workspacePlanAssignments.planId))
      .where(eq(users.isPlatformAdmin, false))
      .orderBy(desc(users.createdAt));
    const unique = [
      ...new Map(records.map((record) => [record.id, record])).values(),
    ];
    const rows: Row[] = unique.map((record) => ({
      id: record.id,
      cells: [
        { primary: record.name, secondary: record.email },
        {
          primary: '',
          primaryKey: `role.${this.role(record.role)}`,
          secondary: record.workspaceName ?? undefined,
        },
        record.planName
          ? { primary: record.planName }
          : { primary: '', primaryKey: 'noPlan' },
        record.workspaceName
          ? { primary: record.workspaceName }
          : { primary: '', primaryKey: 'noWorkspace' },
        { primary: '', primaryDate: record.createdAt.toISOString() },
      ],
      statusKey: record.status === 'active' ? 'active' : 'deactivated',
      tone: record.status === 'active' ? 'success' : 'neutral',
      actions:
        record.status === 'active'
          ? [
              this.actionItem('view', 'viewUser'),
              this.actionItem('edit', 'editUser'),
              this.actionItem('impersonate', 'impersonate'),
              this.actionItem('grant_credits', 'grantCredits', undefined, [
                'creditUnits',
              ]),
              this.actionItem('deactivate', 'deactivate', 'destructive'),
            ]
          : [
              this.actionItem('view', 'viewUser'),
              this.actionItem('reactivate', 'reactivate', 'success'),
            ],
    }));
    const now = Date.now();
    const metrics: Metric[] = [
      this.metric('users.users.total', unique.length),
      this.metric(
        'users.users.new',
        unique.filter((row) => now - row.createdAt.getTime() <= 604_800_000)
          .length,
      ),
      this.metric(
        'users.users.withPlan',
        unique.length
          ? `${Math.round((unique.filter((row) => row.planName).length / unique.length) * 100)}%`
          : '0%',
      ),
      this.metric(
        'users.users.review',
        unique.filter((row) => !row.workspaceName || !row.planName).length,
      ),
    ];
    return this.paginate(metrics, rows, query);
  }

  private async creditsView(query: AdminOperationQuery) {
    if (!['packs', 'ledger', 'usage'].includes(query.tab))
      throw new BadRequestException();
    if (query.tab === 'packs') {
      const records = await this.database.db
        .select({
          id: creditPackages.id,
          name: creditPackages.name,
          slug: creditPackages.slug,
          units: creditPackages.units,
          priceMinor: creditPackages.priceMinor,
          currency: creditPackages.currency,
          status: creditPackages.status,
          featured: creditPackages.featured,
          position: creditPackages.position,
          purchases: sql<number>`count(${billingPayments.id})::int`,
        })
        .from(creditPackages)
        .leftJoin(
          billingPayments,
          and(
            eq(billingPayments.creditPackageId, creditPackages.id),
            eq(billingPayments.status, 'paid'),
          ),
        )
        .groupBy(creditPackages.id)
        .orderBy(asc(creditPackages.position));
      const rows: Row[] = records.map((record) => ({
        id: record.id,
        cells: [
          { primary: record.name, secondary: record.slug },
          { primary: '', primaryNumber: record.units },
          {
            primary: '',
            primaryMoney: {
              amountMinor: record.priceMinor,
              currency: record.currency,
            },
          },
          { primary: '', primaryNumber: record.purchases },
          { primary: String(record.position) },
        ],
        statusKey: record.status === 'active' ? 'active' : 'hidden',
        tone: record.status === 'active' ? 'success' : 'neutral',
        actions: [
          this.actionItem('edit', 'editPack'),
          record.status === 'active'
            ? this.actionItem('duplicate', 'duplicate')
            : this.actionItem('reactivate', 'activate', 'success'),
          this.actionItem('remove', 'remove', 'destructive'),
        ],
      }));
      const sales = records.reduce((total, item) => total + item.purchases, 0);
      return this.paginate(
        [
          this.metric('credits.packs.total', records.length),
          this.metric(
            'credits.packs.active',
            records.filter((item) => item.status === 'active').length,
          ),
          this.metric(
            'credits.packs.featured',
            records.filter((item) => item.featured).length,
          ),
          this.metric('credits.packs.sales', sales),
        ],
        rows,
        query,
      );
    }

    const ledger = await this.database.db
      .select({
        id: creditLedgerEntries.id,
        name: users.displayName,
        email: users.email,
        type: creditLedgerEntries.type,
        action: creditLedgerEntries.action,
        units: creditLedgerEntries.units,
        metadata: creditLedgerEntries.metadata,
        createdAt: creditLedgerEntries.createdAt,
      })
      .from(creditLedgerEntries)
      .leftJoin(users, eq(users.id, creditLedgerEntries.actorUserId))
      .orderBy(desc(creditLedgerEntries.createdAt));
    if (query.tab === 'ledger') {
      const rows: Row[] = ledger.map((record) => ({
        id: record.id,
        cells: [
          record.name
            ? { primary: record.name, secondary: record.email ?? undefined }
            : { primary: '', primaryKey: 'system' },
          {
            primary: '',
            primaryKey: `ledgerType.${this.ledgerType(record.type)}`,
          },
          {
            primary: this.metadataString(record.metadata, 'packageName') ?? '—',
          },
          {
            primary: '',
            primaryKey: record.units > 0 ? 'creditsAdded' : 'creditsRemoved',
            primaryNumber: Math.abs(record.units),
          },
          { primary: '—' },
          { primary: '', primaryDate: record.createdAt.toISOString() },
        ],
        statusKey: record.type === 'adjustment' ? 'manual' : 'applied',
        tone: record.type === 'adjustment' ? 'warning' : 'success',
        actions: [this.actionItem('view', 'viewLedgerEntry')],
      }));
      const credits = await this.database.db
        .select()
        .from(workspaceCreditAccounts);
      return this.paginate(
        [
          this.metric('credits.ledger.total', ledger.length),
          this.metric(
            'credits.ledger.purchases',
            ledger.filter((item) => item.action === 'credits.purchase').length,
          ),
          this.metricNumber(
            'credits.ledger.granted',
            ledger
              .filter((item) => item.units > 0)
              .reduce((sum, item) => sum + item.units, 0),
          ),
          this.metricNumber(
            'credits.ledger.available',
            credits.reduce((sum, item) => sum + item.balanceUnits, 0),
          ),
        ],
        rows,
        query,
      );
    }
    const usage = ledger.filter(
      (item) => item.type === 'debit' || item.type === 'refund',
    );
    const rows: Row[] = usage.map((record) => ({
      id: record.id,
      cells: [
        record.name
          ? { primary: record.name, secondary: record.email ?? undefined }
          : { primary: '', primaryKey: 'system' },
        { primary: record.action, mono: true },
        {
          primary:
            this.metadataString(record.metadata, 'feature') ??
            this.actionName(record.action),
        },
        { primary: '', primaryNumber: Math.abs(record.units) },
        { primary: '1' },
        { primary: '', primaryDate: record.createdAt.toISOString() },
      ],
      statusKey: record.type === 'refund' ? 'reverted' : 'charged',
      tone: record.type === 'refund' ? 'neutral' : 'success',
      actions: [this.actionItem('view', 'viewDetail')],
    }));
    return this.paginate(
      [
        this.metric('credits.usage.total', usage.length),
        this.metricNumber(
          'credits.usage.consumed',
          usage
            .filter((item) => item.units < 0)
            .reduce((sum, item) => sum + Math.abs(item.units), 0),
        ),
        this.metric(
          'credits.usage.users',
          new Set(usage.map((item) => item.email).filter(Boolean)).size,
        ),
        this.metric(
          'credits.usage.actions',
          new Set(usage.map((item) => item.action)).size,
        ),
      ],
      rows,
      query,
    );
  }

  private async affiliateView(query: AdminOperationQuery) {
    if (query.tab === 'overview') {
      const profiles = await this.database.db
        .select({
          id: affiliateProfiles.id,
          name: users.displayName,
          email: users.email,
          code: affiliateProfiles.code,
          status: affiliateProfiles.status,
          clicks: sql<number>`(
            select count(*)::int from ${affiliateReferralVisits} visits
            where visits.affiliate_profile_id = ${affiliateProfiles.id}
          )`,
          conversions: sql<number>`(
            select count(*)::int from ${affiliateCommissions} commissions
            where commissions.affiliate_profile_id = ${affiliateProfiles.id}
          )`,
          balance: sql<number>`(
            select greatest(
              coalesce(sum(commissions.amount_minor), 0) -
              coalesce((
                select sum(withdrawals.amount_minor)
                from ${affiliateWithdrawals} withdrawals
                where withdrawals.affiliate_profile_id = ${affiliateProfiles.id}
                  and withdrawals.status in ('requested', 'approved', 'paid')
              ), 0),
              0
            )::int
            from ${affiliateCommissions} commissions
            where commissions.affiliate_profile_id = ${affiliateProfiles.id}
              and commissions.status = 'available'
          )`,
          currency: affiliateProfiles.payoutCurrency,
        })
        .from(affiliateProfiles)
        .innerJoin(users, eq(users.id, affiliateProfiles.userId))
        .orderBy(desc(affiliateProfiles.createdAt));
      const rows: Row[] = profiles.map((record) => ({
        id: record.id,
        cells: [
          { primary: record.name, secondary: record.email },
          { primary: record.code, mono: true },
          { primary: '', primaryNumber: record.clicks },
          { primary: '', primaryNumber: record.conversions },
          {
            primary: '',
            primaryMoney: {
              amountMinor: record.balance,
              currency: record.currency,
            },
          },
        ],
        statusKey: record.status === 'active' ? 'active' : 'paused',
        tone: record.status === 'active' ? 'success' : 'neutral',
        actions:
          record.status === 'active'
            ? [
                this.actionItem('view', 'viewAffiliate'),
                this.actionItem('view', 'viewCommissions'),
              ]
            : [
                this.actionItem('view', 'viewAffiliate'),
                this.actionItem('reactivate', 'reactivate', 'success'),
              ],
      }));
      return this.paginate(
        [
          this.metric(
            'affiliate.overview.total',
            profiles.filter((item) => item.status === 'active').length,
          ),
          this.metricNumber(
            'affiliate.overview.clicks',
            profiles.reduce((sum, item) => sum + item.clicks, 0),
          ),
          this.metricNumber(
            'affiliate.overview.conversions',
            profiles.reduce((sum, item) => sum + item.conversions, 0),
          ),
          this.metricMoney(
            'affiliate.overview.approved',
            profiles.reduce((sum, item) => sum + item.balance, 0),
            'USD',
          ),
        ],
        rows,
        query,
      );
    }
    if (query.tab === 'commissions') {
      const records = await this.database.db
        .select({
          id: affiliateCommissions.id,
          affiliateName: users.displayName,
          referredName: sql<string | null>`(
            select referred.display_name from ${users} referred
            where referred.id = ${affiliateReferrals.referredUserId}
          )`,
          referredEmail: sql<string | null>`(
            select referred.email from ${users} referred
            where referred.id = ${affiliateReferrals.referredUserId}
          )`,
          reference: affiliateCommissions.externalReference,
          amount: affiliateCommissions.amountMinor,
          currency: affiliateCommissions.currency,
          status: affiliateCommissions.status,
          createdAt: affiliateCommissions.createdAt,
        })
        .from(affiliateCommissions)
        .innerJoin(
          affiliateProfiles,
          eq(affiliateProfiles.id, affiliateCommissions.affiliateProfileId),
        )
        .innerJoin(users, eq(users.id, affiliateProfiles.userId))
        .leftJoin(
          affiliateReferrals,
          eq(affiliateReferrals.id, affiliateCommissions.referralId),
        )
        .orderBy(desc(affiliateCommissions.createdAt));
      const rows: Row[] = records.map((record) => ({
        id: record.id,
        cells: [
          { primary: record.affiliateName },
          record.referredName
            ? {
                primary: record.referredName,
                secondary: record.referredEmail ?? undefined,
              }
            : { primary: '', primaryKey: 'noReferredUser' },
          { primary: record.reference ?? '—', mono: true },
          {
            primary: '',
            primaryMoney: {
              amountMinor: record.amount,
              currency: record.currency,
            },
          },
          { primary: '', primaryDate: record.createdAt.toISOString() },
        ],
        statusKey: this.commissionStatus(record.status),
        tone:
          record.status === 'pending'
            ? 'warning'
            : record.status === 'available'
              ? 'success'
              : 'neutral',
        actions:
          record.status === 'pending'
            ? [
                this.actionItem('approve', 'approve', 'success'),
                this.actionItem('reject', 'reject', 'destructive'),
              ]
            : [this.actionItem('view', 'viewDetail')],
      }));
      return this.paginate(
        [
          this.metric('affiliate.commissions.total', records.length),
          this.metric(
            'affiliate.commissions.pending',
            records.filter((item) => item.status === 'pending').length,
          ),
          this.metricMoney(
            'affiliate.commissions.available',
            records
              .filter((item) => item.status === 'available')
              .reduce((sum, item) => sum + item.amount, 0),
            'USD',
          ),
          this.metric(
            'affiliate.commissions.rejected',
            records.filter((item) => item.status === 'cancelled').length,
          ),
        ],
        rows,
        query,
      );
    }
    if (query.tab !== 'withdrawals') throw new BadRequestException();
    const records = await this.database.db
      .select({
        id: affiliateWithdrawals.id,
        name: users.displayName,
        email: users.email,
        reference: affiliateWithdrawals.paymentReference,
        amount: affiliateWithdrawals.amountMinor,
        currency: affiliateWithdrawals.currency,
        status: affiliateWithdrawals.status,
        createdAt: affiliateWithdrawals.createdAt,
      })
      .from(affiliateWithdrawals)
      .innerJoin(
        affiliateProfiles,
        eq(affiliateProfiles.id, affiliateWithdrawals.affiliateProfileId),
      )
      .innerJoin(users, eq(users.id, affiliateProfiles.userId))
      .orderBy(desc(affiliateWithdrawals.createdAt));
    const rows: Row[] = records.map((record) => ({
      id: record.id,
      cells: [
        { primary: record.name, secondary: record.email },
        { primary: `WD-${record.id.slice(0, 8).toUpperCase()}`, mono: true },
        {
          primary: '',
          primaryKey: record.reference ? 'referenceSet' : 'referencePending',
        },
        {
          primary: '',
          primaryMoney: {
            amountMinor: record.amount,
            currency: record.currency,
          },
        },
        { primary: '', primaryDate: record.createdAt.toISOString() },
      ],
      statusKey: this.withdrawalStatus(record.status),
      tone:
        record.status === 'requested'
          ? 'warning'
          : record.status === 'approved'
            ? 'success'
            : 'neutral',
      actions:
        record.status === 'requested'
          ? [
              this.actionItem('approve', 'approve', 'success'),
              this.actionItem('reject', 'reject', 'destructive'),
            ]
          : record.status === 'approved'
            ? [
                this.actionItem('mark_paid', 'markPaid', 'success'),
                this.actionItem('view', 'viewDetail'),
              ]
            : [this.actionItem('view', 'viewDetail')],
    }));
    return this.paginate(
      [
        this.metric('affiliate.withdrawals.total', records.length),
        this.metric(
          'affiliate.withdrawals.pending',
          records.filter((item) => item.status === 'requested').length,
        ),
        this.metricMoney(
          'affiliate.withdrawals.approved',
          records
            .filter((item) => item.status === 'approved')
            .reduce((sum, item) => sum + item.amount, 0),
          'USD',
        ),
        this.metricMoney(
          'affiliate.withdrawals.paid',
          records
            .filter((item) => item.status === 'paid')
            .reduce((sum, item) => sum + item.amount, 0),
          'USD',
        ),
      ],
      rows,
      query,
    );
  }

  private async couponsView(query: AdminOperationQuery) {
    if (query.tab !== 'coupons') throw new BadRequestException();
    const records = await this.database.db
      .select()
      .from(billingCoupons)
      .orderBy(desc(billingCoupons.createdAt));
    const now = new Date();
    const rows: Row[] = records.map((record) => {
      const expired = Boolean(record.endsAt && record.endsAt < now);
      const statusKey = expired
        ? 'expired'
        : record.status === 'active'
          ? 'active'
          : 'inactive';
      const cells: Cell[] = [
        { primary: record.name, secondary: record.code, mono: true },
        {
          primary: '',
          ...(record.type === 'percentage'
            ? {
                primaryKey: 'percentDiscount',
                primaryNumber: record.value / 100,
              }
            : {
                primaryMoney: {
                  amountMinor: record.value,
                  currency: record.currency ?? 'USD',
                },
              }),
        },
        {
          primary: '',
          primaryKey: record.maxRedemptions
            ? 'redemptionsWithLimit'
            : 'redemptionsUnlimited',
          primaryNumber: record.redemptionCount,
          ...(record.maxRedemptions
            ? { primaryArgs: { limit: String(record.maxRedemptions) } }
            : {}),
        },
        record.eligiblePlanIds.length
          ? {
              primary: '',
              primaryKey: 'eligiblePlans',
              primaryArgs: { count: String(record.eligiblePlanIds.length) },
            }
          : { primary: '', primaryKey: 'allPayments' },
        record.endsAt
          ? {
              primary: '',
              primaryKey: 'untilDate',
              primaryDate: record.endsAt.toISOString(),
            }
          : { primary: '', primaryKey: 'noExpiry' },
      ];
      return {
        id: record.id,
        cells,
        statusKey,
        tone: statusKey === 'active' ? 'success' : 'neutral',
        actions: [
          this.actionItem('edit', 'editCoupon'),
          this.actionItem('duplicate', 'duplicate'),
          this.actionItem('remove', 'remove', 'destructive'),
        ],
      } satisfies Row;
    });
    return this.paginate(
      [
        this.metric('coupons.coupons.total', records.length),
        this.metric(
          'coupons.coupons.active',
          records.filter(
            (item) =>
              item.status === 'active' && (!item.endsAt || item.endsAt > now),
          ).length,
        ),
        this.metric(
          'coupons.coupons.redemptions',
          records.reduce((sum, item) => sum + item.redemptionCount, 0),
        ),
        this.metric(
          'coupons.coupons.unlimited',
          records.filter((item) => item.maxRedemptions === null).length,
        ),
      ],
      rows,
      query,
    );
  }

  private async paymentsView(query: AdminOperationQuery) {
    if (query.tab !== 'payments') throw new BadRequestException();
    const records = await this.database.db
      .select({
        id: billingPayments.id,
        invoice: billingPayments.invoiceNumber,
        externalId: billingPayments.externalOrderId,
        name: users.displayName,
        email: users.email,
        product: billingPayments.productLabel,
        amount: billingPayments.amountMinor,
        currency: billingPayments.currency,
        status: billingPayments.status,
        createdAt: billingPayments.createdAt,
      })
      .from(billingPayments)
      .innerJoin(users, eq(users.id, billingPayments.userId))
      .orderBy(desc(billingPayments.createdAt));
    const rows: Row[] = records.map((record) => ({
      id: record.id,
      cells: [
        {
          primary: record.invoice ?? record.externalId,
          secondary: 'Polar.sh',
          mono: true,
        },
        { primary: record.name, secondary: record.email },
        { primary: record.product },
        { primary: this.shortId(record.externalId), mono: true },
        {
          primary: '',
          primaryMoney: {
            amountMinor: record.amount,
            currency: record.currency,
          },
        },
        { primary: '', primaryDate: record.createdAt.toISOString() },
      ],
      statusKey: this.paymentStatus(record.status),
      tone:
        record.status === 'paid'
          ? 'success'
          : record.status === 'pending'
            ? 'warning'
            : 'neutral',
      actions:
        record.status === 'paid'
          ? [
              this.actionItem('view', 'viewReceipt'),
              this.actionItem('refund', 'refund', 'destructive'),
            ]
          : record.status === 'pending'
            ? [
                this.actionItem('view', 'viewDetail'),
                this.actionItem('sync', 'sync'),
              ]
            : [
                this.actionItem('view', 'viewReceipt'),
                this.actionItem('view', 'viewRefund'),
              ],
    }));
    return this.paginate(
      [
        this.metric('payments.payments.total', records.length),
        this.metric(
          'payments.payments.completed',
          records.filter((item) => item.status === 'paid').length,
        ),
        this.metric(
          'payments.payments.refunded',
          records.filter((item) => item.status.includes('refund')).length,
        ),
        this.metricMoney(
          'payments.payments.volume',
          records
            .filter((item) => item.status === 'paid')
            .reduce((sum, item) => sum + item.amount, 0),
          'USD',
        ),
      ],
      rows,
      query,
    );
  }

  private async subscriptionsView(query: AdminOperationQuery) {
    if (query.tab !== 'subscriptions') throw new BadRequestException();
    const records = await this.database.db
      .select({
        id: billingSubscriptions.id,
        externalId: billingSubscriptions.externalSubscriptionId,
        name: users.displayName,
        email: users.email,
        planName: plans.name,
        amount: billingSubscriptions.amountMinor,
        currency: billingSubscriptions.currency,
        interval: billingSubscriptions.interval,
        status: billingSubscriptions.status,
        cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd,
        renewsAt: billingSubscriptions.currentPeriodEndsAt,
        updatedAt: billingSubscriptions.updatedAt,
      })
      .from(billingSubscriptions)
      .innerJoin(users, eq(users.id, billingSubscriptions.userId))
      .innerJoin(plans, eq(plans.id, billingSubscriptions.planId))
      .orderBy(desc(billingSubscriptions.updatedAt));
    const rows: Row[] = records.map((record) => ({
      id: record.id,
      cells: [
        {
          primary: this.shortId(record.externalId),
          secondary: 'Polar.sh',
          mono: true,
        },
        { primary: record.name, secondary: record.email },
        {
          primary: `${record.planName} ${record.interval === 'month' ? 'mensual' : 'anual'}`,
        },
        {
          primary: '',
          primaryKey: record.interval === 'month' ? 'perMonth' : 'perYear',
          primaryMoney: {
            amountMinor: record.amount,
            currency: record.currency,
          },
        },
        record.renewsAt
          ? { primary: '', primaryDate: record.renewsAt.toISOString() }
          : { primary: '—' },
        { primary: '', primaryDate: record.updatedAt.toISOString() },
      ],
      statusKey: record.cancelAtPeriodEnd
        ? 'cancelsAtPeriodEnd'
        : this.subscriptionStatus(record.status),
      tone:
        record.status === 'past_due'
          ? 'warning'
          : record.status === 'active' && !record.cancelAtPeriodEnd
            ? 'success'
            : 'neutral',
      actions:
        record.status === 'active'
          ? [
              this.actionItem('view', 'viewSubscription'),
              record.cancelAtPeriodEnd
                ? this.actionItem('uncancel', 'uncancel', 'success')
                : this.actionItem('cancel_period_end', 'cancelAtPeriodEnd'),
              this.actionItem('revoke', 'revoke', 'destructive'),
            ]
          : [this.actionItem('view', 'viewSubscription')],
    }));
    const mrr = records
      .filter((item) => item.status === 'active')
      .reduce(
        (sum, item) =>
          sum +
          (item.interval === 'year'
            ? Math.round(item.amount / 12)
            : item.amount),
        0,
      );
    return this.paginate(
      [
        this.metric('subscriptions.subscriptions.total', records.length),
        this.metric(
          'subscriptions.subscriptions.active',
          records.filter((item) => item.status === 'active').length,
        ),
        this.metric(
          'subscriptions.subscriptions.pastDue',
          records.filter((item) => item.status === 'past_due').length,
        ),
        this.metricMoney('subscriptions.subscriptions.mrr', mrr, 'USD'),
      ],
      rows,
      query,
    );
  }

  private async createUser(session: AuthSession, values: string[]) {
    const [name, rawEmail, planSearch] = values;
    if (!name || !rawEmail || !planSearch || !rawEmail.includes('@'))
      throw new BadRequestException();
    const email = rawEmail.toLowerCase();
    const [plan] = await this.database.db
      .select({ id: plans.id })
      .from(plans)
      .where(
        sql`lower(${plans.name}) = lower(${planSearch}) or lower(${plans.slug}) = lower(${planSearch})`,
      )
      .limit(1);
    if (!plan) throw new BadRequestException('Plan not found');
    try {
      await this.database.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            email,
            displayName: name,
            timezone: 'UTC',
            status: 'active',
            isPlatformAdmin: false,
          })
          .returning({ id: users.id });
        const [workspace] = await tx
          .insert(workspaces)
          .values({
            ownerUserId: user.id,
            name: `${name} workspace`,
            slug: `${this.slug(name)}-${randomUUID().slice(0, 8)}`,
          })
          .returning({ id: workspaces.id });
        await tx.insert(workspaceMemberships).values({
          workspaceId: workspace.id,
          userId: user.id,
          role: 'owner',
        });
        await tx.insert(workspacePlanAssignments).values({
          workspaceId: workspace.id,
          planId: plan.id,
          source: 'admin',
          updatedByUserId: session.user.id,
        });
      });
    } catch (error) {
      if (this.constraint(error))
        throw new ConflictException('Email already exists');
      throw error;
    }
    await this.passwordReset.request({ email });
  }

  private async createCreditPackage(session: AuthSession, values: string[]) {
    const [name, unitsInput, priceInput] = values;
    const units = Number(unitsInput?.replace(/[^0-9]/g, ''));
    const priceMinor = Math.round(
      Number(priceInput?.replace(/[^0-9.,]/g, '').replace(',', '.')) * 100,
    );
    if (
      !name ||
      !Number.isInteger(units) ||
      units <= 0 ||
      !Number.isInteger(priceMinor) ||
      priceMinor < 0
    )
      throw new BadRequestException();
    const [{ maxPosition }] = await this.database.db
      .select({
        maxPosition: sql<number>`coalesce(max(${creditPackages.position}), 0)::int`,
      })
      .from(creditPackages);
    await this.database.db.insert(creditPackages).values({
      name,
      slug: `${this.slug(name)}-${randomUUID().slice(0, 6)}`,
      units,
      priceMinor,
      position: maxPosition + 1,
      createdByUserId: session.user.id,
      updatedByUserId: session.user.id,
    });
  }

  private async createCoupon(session: AuthSession, values: string[]) {
    const [name, rawCode, rawValue] = values;
    if (!name || !rawCode || !rawValue) throw new BadRequestException();
    const percentage = rawValue.includes('%');
    const numeric = Number(rawValue.replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (
      !Number.isFinite(numeric) ||
      numeric <= 0 ||
      (percentage && numeric > 100)
    )
      throw new BadRequestException();
    const [coupon] = await this.database.db
      .insert(billingCoupons)
      .values({
        name,
        code: rawCode.toUpperCase(),
        type: percentage ? 'percentage' : 'fixed',
        value: percentage
          ? Math.round(numeric * 100)
          : Math.round(numeric * 100),
        currency: percentage ? null : 'USD',
        createdByUserId: session.user.id,
        updatedByUserId: session.user.id,
      })
      .returning();
    await this.syncNewCoupon(coupon);
  }

  private async userAction(
    session: AuthSession,
    id: string,
    action: AdminOperationActionKey,
    values?: string[],
  ) {
    if (action === 'grant_credits') {
      const units = Number(values?.[0]);
      if (!Number.isInteger(units) || units <= 0 || units > 1_000_000) {
        throw new BadRequestException('Invalid credit amount');
      }
      const [membership] = await this.database.db
        .select({ workspaceId: workspaceMemberships.workspaceId })
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.userId, id))
        .orderBy(asc(workspaceMemberships.createdAt))
        .limit(1);
      if (!membership) throw new NotFoundException();
      await this.database.db.transaction(async (tx) => {
        await tx
          .insert(workspaceCreditAccounts)
          .values({
            workspaceId: membership.workspaceId,
            balanceUnits: units,
          })
          .onConflictDoUpdate({
            target: workspaceCreditAccounts.workspaceId,
            set: {
              balanceUnits: sql`${workspaceCreditAccounts.balanceUnits} + ${units}`,
              updatedAt: new Date(),
            },
          });
        await tx.insert(creditLedgerEntries).values({
          workspaceId: membership.workspaceId,
          actorUserId: session.user.id,
          type: 'grant',
          action: 'credits.admin_grant',
          units,
          idempotencyKey: `admin-grant-${randomUUID()}`,
          metadata: { grantedToUserId: id },
        });
      });
      return;
    }
    if (action === 'edit') {
      const [name, rawEmail, planSearch] = values ?? [];
      if (!name || !rawEmail?.includes('@') || !planSearch) {
        throw new BadRequestException('Edit values required');
      }
      const [plan] = await this.database.db
        .select({ id: plans.id })
        .from(plans)
        .where(
          sql`lower(${plans.name}) = lower(${planSearch}) or lower(${plans.slug}) = lower(${planSearch})`,
        )
        .limit(1);
      const [membership] = await this.database.db
        .select({ workspaceId: workspaceMemberships.workspaceId })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.userId, id),
            eq(workspaceMemberships.role, 'owner'),
          ),
        )
        .limit(1);
      if (!plan || !membership) throw new BadRequestException();
      try {
        await this.database.db.transaction(async (tx) => {
          await tx
            .update(users)
            .set({
              displayName: name,
              email: rawEmail.toLowerCase(),
              updatedAt: new Date(),
            })
            .where(and(eq(users.id, id), eq(users.isPlatformAdmin, false)));
          await tx
            .insert(workspacePlanAssignments)
            .values({
              workspaceId: membership.workspaceId,
              planId: plan.id,
              source: 'admin',
              updatedByUserId: session.user.id,
            })
            .onConflictDoUpdate({
              target: workspacePlanAssignments.workspaceId,
              set: {
                planId: plan.id,
                source: 'admin',
                updatedByUserId: session.user.id,
                updatedAt: new Date(),
              },
            });
        });
      } catch (error) {
        if (this.constraint(error))
          throw new ConflictException('Email already exists');
        throw error;
      }
      return;
    }
    const status =
      action === 'deactivate'
        ? 'inactive'
        : action === 'reactivate'
          ? 'active'
          : null;
    if (!status) throw new BadRequestException();
    const [updated] = await this.database.db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.isPlatformAdmin, false)))
      .returning({ id: users.id });
    if (!updated) throw new NotFoundException();
  }

  private async creditAction(
    session: AuthSession,
    tab: string,
    id: string,
    action: AdminOperationActionKey,
    values?: string[],
  ) {
    if (tab !== 'packs') throw new BadRequestException();
    const [record] = await this.database.db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.id, id))
      .limit(1);
    if (!record) throw new NotFoundException();
    if (action === 'reactivate')
      await this.database.db
        .update(creditPackages)
        .set({
          status: 'active',
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(creditPackages.id, id));
    else if (action === 'remove')
      await this.database.db
        .update(creditPackages)
        .set({
          status: 'hidden',
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(creditPackages.id, id));
    else if (action === 'duplicate')
      await this.database.db.insert(creditPackages).values({
        ...record,
        id: randomUUID(),
        name: `${record.name} copia`,
        slug: `${record.slug}-copy-${randomUUID().slice(0, 5)}`,
        status: 'hidden',
        featured: false,
        createdByUserId: session.user.id,
        updatedByUserId: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    else if (action === 'edit') {
      const [name, unitsInput, priceInput] = values ?? [];
      const units = Number(unitsInput?.replace(/[^0-9]/g, ''));
      const priceMinor = Math.round(
        Number(priceInput?.replace(/[^0-9.,]/g, '').replace(',', '.')) * 100,
      );
      if (
        !name ||
        !Number.isInteger(units) ||
        units <= 0 ||
        !Number.isInteger(priceMinor) ||
        priceMinor < 0
      )
        throw new BadRequestException();
      await this.database.db
        .update(creditPackages)
        .set({
          name,
          units,
          priceMinor,
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(creditPackages.id, id));
    } else throw new BadRequestException();
  }

  private async couponAction(
    session: AuthSession,
    id: string,
    action: AdminOperationActionKey,
    values?: string[],
  ) {
    const [record] = await this.database.db
      .select()
      .from(billingCoupons)
      .where(eq(billingCoupons.id, id))
      .limit(1);
    if (!record) throw new NotFoundException();
    if (action === 'remove') {
      if (record.externalDiscountId) {
        const client = await this.polar.client();
        await client.discounts.delete({ id: record.externalDiscountId });
      }
      await this.database.db
        .update(billingCoupons)
        .set({
          status: 'inactive',
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(billingCoupons.id, id));
    } else if (action === 'duplicate')
      await this.database.db.insert(billingCoupons).values({
        ...record,
        id: randomUUID(),
        name: `${record.name} copia`,
        code: `${record.code}-${randomUUID().slice(0, 4).toUpperCase()}`,
        externalDiscountId: null,
        syncStatus: 'pending',
        redemptionCount: 0,
        status: 'inactive',
        createdByUserId: session.user.id,
        updatedByUserId: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    else if (action === 'edit') {
      const [name, code, rawValue] = values ?? [];
      const numeric = Number(
        rawValue?.replace(/[^0-9.,]/g, '').replace(',', '.'),
      );
      if (!name || !code || !Number.isFinite(numeric) || numeric <= 0)
        throw new BadRequestException();
      await this.database.db
        .update(billingCoupons)
        .set({
          name,
          code: code.toUpperCase(),
          value: Math.round(numeric * 100),
          syncStatus: 'pending',
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(billingCoupons.id, id));
      if (record.externalDiscountId) {
        const client = await this.polar.client();
        await client.discounts.update({
          id: record.externalDiscountId,
          discountUpdate: {
            name,
            code: code.toUpperCase(),
            type: record.type,
            basisPoints:
              record.type === 'percentage' ? Math.round(numeric * 100) : null,
            amounts:
              record.type === 'fixed'
                ? { [record.currency ?? 'USD']: Math.round(numeric * 100) }
                : null,
          },
        });
        await this.database.db
          .update(billingCoupons)
          .set({ syncStatus: 'synced', updatedAt: new Date() })
          .where(eq(billingCoupons.id, id));
      }
    } else throw new BadRequestException();
  }

  private async affiliateAction(
    session: AuthSession,
    tab: string,
    id: string,
    action: AdminOperationActionKey,
  ) {
    const now = new Date();
    if (tab === 'overview' && action === 'reactivate') {
      await this.database.db
        .update(affiliateProfiles)
        .set({ status: 'active', updatedAt: now })
        .where(eq(affiliateProfiles.id, id));
      return;
    }
    if (tab === 'commissions' && ['approve', 'reject'].includes(action)) {
      const status = action === 'approve' ? 'available' : 'cancelled';
      const [updated] = await this.database.db
        .update(affiliateCommissions)
        .set({
          status,
          eligibleAt: action === 'approve' ? now : undefined,
          updatedAt: now,
        })
        .where(
          and(
            eq(affiliateCommissions.id, id),
            eq(affiliateCommissions.status, 'pending'),
          ),
        )
        .returning({ id: affiliateCommissions.id });
      if (!updated) throw new ConflictException('Commission already reviewed');
      return;
    }
    if (tab === 'withdrawals') {
      const status =
        action === 'approve'
          ? 'approved'
          : action === 'reject'
            ? 'rejected'
            : action === 'mark_paid'
              ? 'paid'
              : null;
      if (!status) throw new BadRequestException();
      const previous = action === 'mark_paid' ? 'approved' : 'requested';
      const [updated] = await this.database.db
        .update(affiliateWithdrawals)
        .set({
          status,
          reviewedByUserId: session.user.id,
          reviewedAt: now,
          paidAt: status === 'paid' ? now : undefined,
          updatedAt: now,
        })
        .where(
          and(
            eq(affiliateWithdrawals.id, id),
            eq(affiliateWithdrawals.status, previous),
          ),
        )
        .returning({ id: affiliateWithdrawals.id });
      if (!updated) throw new ConflictException('Withdrawal already reviewed');
      return;
    }
    throw new BadRequestException();
  }

  private async paymentAction(
    session: AuthSession,
    id: string,
    action: AdminOperationActionKey,
  ) {
    const [payment] = await this.database.db
      .select()
      .from(billingPayments)
      .where(eq(billingPayments.id, id))
      .limit(1);
    if (!payment) throw new NotFoundException();
    const client = await this.polar.client();
    if (action === 'sync') {
      const remote = await client.orders.get({ id: payment.externalOrderId });
      await this.database.db
        .update(billingPayments)
        .set({
          status: remote.status === 'paid' ? 'paid' : payment.status,
          paidAt:
            remote.status === 'paid'
              ? (payment.paidAt ?? new Date())
              : payment.paidAt,
          updatedAt: new Date(),
        })
        .where(eq(billingPayments.id, id));
      return;
    }
    if (action !== 'refund' || payment.status !== 'paid')
      throw new BadRequestException();
    if (payment.productType === 'credits' && payment.creditPackageId) {
      const [[pack], [account]] = await Promise.all([
        this.database.db
          .select({ units: creditPackages.units })
          .from(creditPackages)
          .where(eq(creditPackages.id, payment.creditPackageId))
          .limit(1),
        this.database.db
          .select({ balance: workspaceCreditAccounts.balanceUnits })
          .from(workspaceCreditAccounts)
          .where(eq(workspaceCreditAccounts.workspaceId, payment.workspaceId))
          .limit(1),
      ]);
      if (!pack || !account || account.balance < pack.units) {
        throw new ConflictException('Purchased credits have already been used');
      }
    }
    const amount = payment.amountMinor - payment.refundedAmountMinor;
    const remote = await client.refunds.create({
      orderId: payment.externalOrderId,
      reason: 'customer_request',
      amount,
      revokeBenefits: payment.productType === 'credits',
      metadata: { zapi_payment_id: payment.id },
    });
    await this.database.db.insert(billingRefunds).values({
      externalRefundId: remote.id,
      paymentId: payment.id,
      requestedByUserId: session.user.id,
      status: remote.status === 'succeeded' ? 'succeeded' : 'pending',
      amountMinor: remote.amount,
      reason: remote.reason,
    });
  }

  private async subscriptionAction(
    _session: AuthSession,
    id: string,
    action: AdminOperationActionKey,
  ) {
    const [subscription] = await this.database.db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.id, id))
      .limit(1);
    if (!subscription) throw new NotFoundException();
    const client = await this.polar.client();
    if (action === 'revoke') {
      const remote = await client.subscriptions.revoke({
        id: subscription.externalSubscriptionId,
      });
      await this.database.db
        .update(billingSubscriptions)
        .set({
          status: 'canceled',
          cancelAtPeriodEnd: false,
          endedAt: remote.endedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(billingSubscriptions.id, id));
      return;
    }
    if (action === 'cancel_period_end' || action === 'uncancel') {
      const cancelAtPeriodEnd = action === 'cancel_period_end';
      await client.subscriptions.update({
        id: subscription.externalSubscriptionId,
        subscriptionUpdate: { cancelAtPeriodEnd },
      });
      await this.database.db
        .update(billingSubscriptions)
        .set({ cancelAtPeriodEnd, updatedAt: new Date() })
        .where(eq(billingSubscriptions.id, id));
      return;
    }
    throw new BadRequestException();
  }

  private async syncNewCoupon(coupon: typeof billingCoupons.$inferSelect) {
    try {
      const client = await this.polar.client();
      const remote = await client.discounts.create(
        coupon.type === 'percentage'
          ? {
              type: 'percentage',
              name: coupon.name,
              code: coupon.code,
              duration: coupon.duration,
              basisPoints: coupon.value,
              startsAt: coupon.startsAt,
              endsAt: coupon.endsAt,
              maxRedemptions: coupon.maxRedemptions,
              metadata: { zapi_coupon_id: coupon.id },
            }
          : {
              type: 'fixed',
              name: coupon.name,
              code: coupon.code,
              duration: coupon.duration,
              amounts: { [coupon.currency ?? 'USD']: coupon.value },
              startsAt: coupon.startsAt,
              endsAt: coupon.endsAt,
              maxRedemptions: coupon.maxRedemptions,
              metadata: { zapi_coupon_id: coupon.id },
            },
      );
      await this.database.db
        .update(billingCoupons)
        .set({
          externalDiscountId: remote.id,
          syncStatus: 'synced',
          updatedAt: new Date(),
        })
        .where(eq(billingCoupons.id, coupon.id));
    } catch (error) {
      if (error instanceof ServiceUnavailableException) return;
      await this.database.db
        .update(billingCoupons)
        .set({ syncStatus: 'failed', updatedAt: new Date() })
        .where(eq(billingCoupons.id, coupon.id));
    }
  }

  private paginate(
    metrics: Metric[],
    source: Row[],
    query: AdminOperationQuery,
  ): AdminOperationView {
    const q = query.q?.toLocaleLowerCase('es') ?? '';
    const filtered = source.filter((row) => {
      const matchesSearch =
        !q ||
        row.cells.some((cell) =>
          `${cell.primary} ${cell.secondary ?? ''}`
            .toLocaleLowerCase('es')
            .includes(q),
        );
      return (
        matchesSearch &&
        (!query.status ||
          query.status === 'all' ||
          row.statusKey === query.status)
      );
    });
    const pageCount = Math.max(1, Math.ceil(filtered.length / query.pageSize));
    const page = Math.min(query.page, pageCount);
    const start = (page - 1) * query.pageSize;
    return {
      metrics,
      rows: filtered.slice(start, start + query.pageSize),
      statusOptions: [...new Set(source.map((row) => row.statusKey))],
      pagination: {
        page,
        pageSize: query.pageSize,
        pageCount,
        total: filtered.length,
        rangeStart: filtered.length ? start + 1 : 0,
        rangeEnd: Math.min(start + query.pageSize, filtered.length),
      },
    };
  }

  private parseModule(value: string): AdminOperationModule {
    const parsed = adminOperationModuleSchema.safeParse(value);
    if (!parsed.success) throw new NotFoundException();
    return parsed.data;
  }

  private parseQuery(value: unknown): AdminOperationQuery {
    const parsed = adminOperationQuerySchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException();
    return parsed.data;
  }

  private metric(key: string, value: string | number): Metric {
    return { key, value: String(value) };
  }

  private metricNumber(key: string, value: number): Metric {
    return { key, value: '', numberValue: value };
  }

  private metricMoney(key: string, amountMinor: number, currency: string) {
    return { key, value: '', moneyValue: { amountMinor, currency } };
  }

  private actionItem(
    key: AdminOperationActionKey,
    labelKey: string,
    kind?: 'destructive' | 'success',
    fieldKeys?: string[],
  ) {
    return { key, labelKey, kind, ...(fieldKeys ? { fieldKeys } : {}) };
  }

  private shortId(value: string) {
    return value.length > 14
      ? `${value.slice(0, 8)}…${value.slice(-4)}`
      : value;
  }

  private role(value: string | null) {
    return value === 'owner'
      ? 'owner'
      : value === 'admin'
        ? 'admin'
        : value === 'member'
          ? 'member'
          : 'none';
  }

  private ledgerType(value: string) {
    return value === 'grant'
      ? 'purchase'
      : value === 'debit'
        ? 'spend'
        : value === 'refund'
          ? 'reversal'
          : 'adjustment';
  }

  private actionName(value: string) {
    return value
      .split('.')
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }

  private metadataString(value: Record<string, unknown>, key: string) {
    return typeof value[key] === 'string' ? value[key] : undefined;
  }

  private commissionStatus(value: string) {
    return value === 'pending'
      ? 'commissionPending'
      : value === 'available'
        ? 'commissionAvailable'
        : value === 'paid'
          ? 'commissionPaid'
          : 'commissionRejected';
  }

  private withdrawalStatus(value: string) {
    return value === 'requested'
      ? 'withdrawalRequested'
      : value === 'approved'
        ? 'withdrawalApproved'
        : value === 'paid'
          ? 'withdrawalPaid'
          : 'withdrawalRejected';
  }

  private paymentStatus(value: string) {
    return value === 'paid'
      ? 'paymentCompleted'
      : value === 'pending'
        ? 'paymentPending'
        : value === 'refunded'
          ? 'paymentRefunded'
          : value === 'partially_refunded'
            ? 'paymentPartiallyRefunded'
            : 'paymentFailed';
  }

  private subscriptionStatus(value: string) {
    return value === 'active'
      ? 'subscriptionActive'
      : value === 'trialing'
        ? 'subscriptionTrialing'
        : value === 'past_due'
          ? 'subscriptionPastDue'
          : value === 'paused'
            ? 'subscriptionPaused'
            : value === 'canceled'
              ? 'subscriptionCanceled'
              : value === 'unpaid'
                ? 'subscriptionUnpaid'
                : 'subscriptionIncomplete';
  }

  private slug(value: string) {
    return (
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'usuario'
    );
  }

  private constraint(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
