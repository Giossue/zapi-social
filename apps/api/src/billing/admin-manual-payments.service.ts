import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  billingPayments,
  creditLedgerEntries,
  creditPackages,
  manualPayments,
  plans,
  platformSettings,
  users,
  workspaceCreditAccounts,
  workspaceMemberships,
  workspacePlanAssignments,
  workspaces,
} from '@workspace/database';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
} from '@workspace/database/query';
import {
  adminManualPaymentOptionsQuerySchema,
  adminManualPaymentsQuerySchema,
  createAdminManualPaymentSchema,
  updateManualPaymentSettingsSchema,
  type AdminManualPayment,
  type AdminManualPaymentMetrics,
  type AdminManualPaymentOptions,
  type AdminManualPaymentsResponse,
  type ManualPaymentSettings,
  type PlatformAdminAuthSession,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const SETTINGS_KEY = 'manual_payments';

const DEFAULT_SETTINGS: ManualPaymentSettings = {
  enabled: false,
  referencePrefix: 'PAY-',
  instructions: '',
};

type ManualPaymentRow = {
  payment: typeof manualPayments.$inferSelect;
  workspace: { id: string; name: string };
  user: { id: string; displayName: string; email: string };
  planName: string | null;
  packageName: string | null;
  reviewerName: string | null;
};

@Injectable()
export class AdminManualPaymentsService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: unknown): Promise<AdminManualPaymentsResponse> {
    const filters = this.parse(adminManualPaymentsQuerySchema.safeParse(query));
    const conditions = [];
    if (filters.status !== 'all')
      conditions.push(eq(manualPayments.status, filters.status));
    if (filters.q) {
      const value = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(manualPayments.reference, value),
          ilike(manualPayments.note, value),
          ilike(users.displayName, value),
          ilike(users.email, value),
          ilike(workspaces.name, value),
        )!,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.limit;
    const [rows, totalRows, metrics, settings] = await Promise.all([
      this.baseQuery()
        .where(where)
        .orderBy(desc(manualPayments.createdAt))
        .limit(filters.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(manualPayments)
        .innerJoin(users, eq(manualPayments.userId, users.id))
        .innerJoin(workspaces, eq(manualPayments.workspaceId, workspaces.id))
        .where(where),
      this.metrics(),
      this.settings(),
    ]);
    return {
      payments: rows.map((row) => this.serialize(row)),
      metrics,
      settings,
      page: filters.page,
      limit: filters.limit,
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async options(query: unknown): Promise<AdminManualPaymentOptions> {
    const filters = this.parse(
      adminManualPaymentOptionsQuerySchema.safeParse(query),
    );
    const term = filters.q ? `%${filters.q}%` : null;
    const [workspaceRows, planRows, packageRows] = await Promise.all([
      this.database.db
        .select({ id: workspaces.id, label: workspaces.name })
        .from(workspaces)
        .where(term ? ilike(workspaces.name, term) : undefined)
        .orderBy(asc(workspaces.name))
        .limit(10),
      this.database.db
        .select({
          id: plans.id,
          label: plans.name,
          price: plans.price,
          currency: plans.currency,
        })
        .from(plans)
        .where(eq(plans.status, 'active'))
        .orderBy(asc(plans.name)),
      this.database.db
        .select({
          id: creditPackages.id,
          label: creditPackages.name,
          priceMinor: creditPackages.priceMinor,
          currency: creditPackages.currency,
        })
        .from(creditPackages)
        .where(eq(creditPackages.status, 'active'))
        .orderBy(asc(creditPackages.name)),
    ]);
    return {
      workspaces: workspaceRows,
      plans: planRows.map((row) => ({
        id: row.id,
        label: row.label,
        amountMinor: Math.round(Number(row.price) * 100),
        currency: row.currency,
      })),
      creditPackages: packageRows.map((row) => ({
        id: row.id,
        label: row.label,
        amountMinor: row.priceMinor,
        currency: row.currency,
      })),
    };
  }

  async settings(): Promise<ManualPaymentSettings> {
    const [row] = await this.database.db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, SETTINGS_KEY))
      .limit(1);
    const stored = (row?.value ?? {}) as Partial<ManualPaymentSettings>;
    return {
      enabled: Boolean(stored.enabled ?? DEFAULT_SETTINGS.enabled),
      referencePrefix:
        typeof stored.referencePrefix === 'string'
          ? stored.referencePrefix
          : DEFAULT_SETTINGS.referencePrefix,
      instructions:
        typeof stored.instructions === 'string'
          ? stored.instructions
          : DEFAULT_SETTINGS.instructions,
    };
  }

  async updateSettings(
    session: PlatformAdminAuthSession,
    input: unknown,
  ): Promise<ManualPaymentSettings> {
    const values = this.parse(
      updateManualPaymentSettingsSchema.safeParse(input),
    );
    await this.database.db
      .insert(platformSettings)
      .values({ key: SETTINGS_KEY, value: values })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: values, updatedAt: new Date() },
      });
    await this.database.db.insert(apiAuditLogs).values({
      actorUserId: session.user.id,
      event: 'manual_payment.settings_updated',
      subjectType: 'platform_setting',
      summary: 'Manual payment settings updated',
      metadata: { enabled: values.enabled },
    });
    return values;
  }

  async create(
    session: PlatformAdminAuthSession,
    input: unknown,
  ): Promise<AdminManualPayment> {
    const values = this.parse(createAdminManualPaymentSchema.safeParse(input));
    const owner = await this.workspaceOwner(values.workspaceId);
    const now = new Date();
    const [created] = await this.database.db
      .insert(manualPayments)
      .values({
        workspaceId: values.workspaceId,
        userId: owner,
        planId: values.productType === 'plan' ? (values.planId ?? null) : null,
        creditPackageId:
          values.productType === 'credits'
            ? (values.creditPackageId ?? null)
            : null,
        productType: values.productType,
        reference: values.reference,
        paymentInfo: values.paymentInfo,
        note: values.note,
        amountMinor: values.amountMinor,
        currency: values.currency,
        status: 'pending',
        createdByUserId: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: manualPayments.id })
      .catch(() => {
        throw this.duplicated();
      });
    if (!created) throw this.failed();
    await this.audit(session, created.id, values.workspaceId, 'created');
    return this.get(created.id);
  }

  /**
   * Aprobar materializa el cobro: registra el `billing_payments` equivalente y
   * concede el plan o los créditos con la misma lógica que el webhook de Polar.
   */
  async approve(
    session: PlatformAdminAuthSession,
    id: string,
  ): Promise<AdminManualPayment> {
    const row = await this.find(id);
    if (row.payment.status !== 'pending') throw this.notPending();
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const label = row.planName ?? row.packageName ?? row.payment.reference;
      const [payment] = await tx
        .insert(billingPayments)
        .values({
          externalOrderId: `manual-${row.payment.id}`,
          workspaceId: row.payment.workspaceId,
          userId: row.payment.userId,
          planId: row.payment.planId,
          creditPackageId: row.payment.creditPackageId,
          productType: row.payment.productType,
          productLabel: label,
          status: 'paid',
          amountMinor: row.payment.amountMinor,
          currency: row.payment.currency,
          paidAt: now,
          metadata: {
            source: 'manual',
            manualPaymentId: row.payment.id,
            reference: row.payment.reference,
          },
        })
        .onConflictDoNothing({ target: billingPayments.externalOrderId })
        .returning({ id: billingPayments.id });

      if (row.payment.productType === 'plan' && row.payment.planId) {
        await tx
          .insert(workspacePlanAssignments)
          .values({
            workspaceId: row.payment.workspaceId,
            planId: row.payment.planId,
            source: 'admin',
          })
          .onConflictDoUpdate({
            target: workspacePlanAssignments.workspaceId,
            set: {
              planId: row.payment.planId,
              source: 'admin',
              updatedAt: now,
            },
          });
      }

      if (
        row.payment.productType === 'credits' &&
        row.payment.creditPackageId
      ) {
        const [pack] = await tx
          .select({ units: creditPackages.units, name: creditPackages.name })
          .from(creditPackages)
          .where(eq(creditPackages.id, row.payment.creditPackageId))
          .limit(1);
        if (!pack) throw this.failed();
        await tx
          .insert(workspaceCreditAccounts)
          .values({
            workspaceId: row.payment.workspaceId,
            balanceUnits: pack.units,
          })
          .onConflictDoUpdate({
            target: workspaceCreditAccounts.workspaceId,
            set: {
              balanceUnits: sql`${workspaceCreditAccounts.balanceUnits} + ${pack.units}`,
              updatedAt: now,
            },
          });
        await tx
          .insert(creditLedgerEntries)
          .values({
            workspaceId: row.payment.workspaceId,
            actorUserId: session.user.id,
            type: 'grant',
            action: 'credits.purchase',
            units: pack.units,
            idempotencyKey: `manual-payment-${row.payment.id}`,
            metadata: {
              packageId: row.payment.creditPackageId,
              packageName: pack.name,
              manualPaymentId: row.payment.id,
            },
          })
          .onConflictDoNothing();
      }

      await tx
        .update(manualPayments)
        .set({
          status: 'approved',
          billingPaymentId: payment?.id ?? null,
          reviewedByUserId: session.user.id,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(manualPayments.id, row.payment.id));

      await tx.insert(apiAuditLogs).values({
        workspaceId: row.payment.workspaceId,
        actorUserId: session.user.id,
        event: 'manual_payment.approved',
        subjectType: 'manual_payment',
        subjectId: row.payment.id,
        summary: `Manual payment approved (${row.payment.reference})`,
        metadata: { amountMinor: row.payment.amountMinor },
      });
    });
    return this.get(row.payment.id);
  }

  async reject(
    session: PlatformAdminAuthSession,
    id: string,
  ): Promise<AdminManualPayment> {
    const row = await this.find(id);
    if (row.payment.status !== 'pending') throw this.notPending();
    const now = new Date();
    await this.database.db
      .update(manualPayments)
      .set({
        status: 'rejected',
        reviewedByUserId: session.user.id,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(manualPayments.id, row.payment.id));
    await this.audit(
      session,
      row.payment.id,
      row.payment.workspaceId,
      'rejected',
    );
    return this.get(row.payment.id);
  }

  /** Un pago aprobado ya movió saldo o plan: no se borra, queda como historial. */
  async remove(
    session: PlatformAdminAuthSession,
    id: string,
  ): Promise<{ id: string }> {
    const row = await this.find(id);
    if (row.payment.status === 'approved') throw this.notPending();
    await this.database.db
      .delete(manualPayments)
      .where(eq(manualPayments.id, row.payment.id));
    await this.audit(
      session,
      row.payment.id,
      row.payment.workspaceId,
      'deleted',
    );
    return { id: row.payment.id };
  }

  async get(id: string): Promise<AdminManualPayment> {
    return this.serialize(await this.find(id));
  }

  private baseQuery() {
    return this.database.db
      .select({
        payment: manualPayments,
        workspace: { id: workspaces.id, name: workspaces.name },
        user: {
          id: users.id,
          displayName: users.displayName,
          email: users.email,
        },
        planName: plans.name,
        packageName: creditPackages.name,
        reviewerName: sql<string | null>`reviewer.display_name`,
      })
      .from(manualPayments)
      .innerJoin(users, eq(manualPayments.userId, users.id))
      .innerJoin(workspaces, eq(manualPayments.workspaceId, workspaces.id))
      .leftJoin(plans, eq(manualPayments.planId, plans.id))
      .leftJoin(
        creditPackages,
        eq(manualPayments.creditPackageId, creditPackages.id),
      )
      .leftJoin(
        sql`${users} as reviewer`,
        sql`reviewer.id = ${manualPayments.reviewedByUserId}`,
      )
      .$dynamic();
  }

  private async find(id: string): Promise<ManualPaymentRow> {
    if (!this.isUuid(id)) throw this.notFound();
    const [row] = await this.baseQuery()
      .where(eq(manualPayments.id, id))
      .limit(1);
    if (!row) throw this.notFound();
    return row;
  }

  private async metrics(): Promise<AdminManualPaymentMetrics> {
    const [row] = await this.database.db
      .select({
        pending: sql<number>`count(*) filter (where ${manualPayments.status} = 'pending')`,
        approved: sql<number>`count(*) filter (where ${manualPayments.status} = 'approved')`,
        rejected: sql<number>`count(*) filter (where ${manualPayments.status} = 'rejected')`,
        approvedAmount: sql<string>`coalesce(sum(${manualPayments.amountMinor}) filter (where ${manualPayments.status} = 'approved'), 0)`,
        currency: sql<string | null>`max(${manualPayments.currency})`,
      })
      .from(manualPayments);
    return {
      pending: Number(row?.pending ?? 0),
      approved: Number(row?.approved ?? 0),
      rejected: Number(row?.rejected ?? 0),
      approvedAmountMinor: Number(row?.approvedAmount ?? 0),
      currency: row?.currency ?? 'USD',
    };
  }

  private async workspaceOwner(workspaceId: string) {
    const [owner] = await this.database.db
      .select({ userId: workspaceMemberships.userId })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.role, 'owner'),
        ),
      )
      .limit(1);
    if (!owner)
      throw new AppException(
        'AUTH_WORKSPACE_UNAVAILABLE',
        HttpStatus.BAD_REQUEST,
      );
    return owner.userId;
  }

  private serialize(row: ManualPaymentRow): AdminManualPayment {
    return {
      id: row.payment.id,
      workspace: row.workspace,
      user: row.user,
      productType: row.payment.productType,
      productLabel: row.planName ?? row.packageName ?? '—',
      reference: row.payment.reference,
      paymentInfo: row.payment.paymentInfo,
      note: row.payment.note,
      amountMinor: row.payment.amountMinor,
      currency: row.payment.currency,
      status: row.payment.status,
      reviewedByName: row.reviewerName ?? null,
      reviewedAt: row.payment.reviewedAt?.toISOString() ?? null,
      createdAt: row.payment.createdAt.toISOString(),
    };
  }

  private async audit(
    session: PlatformAdminAuthSession,
    id: string,
    workspaceId: string,
    action: string,
  ) {
    await this.database.db.insert(apiAuditLogs).values({
      workspaceId,
      actorUserId: session.user.id,
      event: `manual_payment.${action}`,
      subjectType: 'manual_payment',
      subjectId: id,
      summary: `Manual payment ${action}`,
      metadata: {},
    });
  }

  private parse<T>(result: { success: true; data: T } | { success: false }) {
    if (!result.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return result.data;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private notFound() {
    return new AppException('MANUAL_PAYMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  private notPending() {
    return new AppException('MANUAL_PAYMENT_NOT_PENDING', HttpStatus.CONFLICT);
  }

  private duplicated() {
    return new AppException(
      'MANUAL_PAYMENT_REFERENCE_TAKEN',
      HttpStatus.CONFLICT,
    );
  }

  private failed() {
    return new AppException('REQUEST_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
