import { HttpStatus, Injectable } from '@nestjs/common';
import { billingPayments, workspaces } from '@workspace/database';
import { and, count, desc, eq, gte, sql } from '@workspace/database/query';
import type { SQL } from '@workspace/database/query';
import {
  adminPaymentReportQuerySchema,
  type AdminPaymentReport,
  type AdminPaymentReportProductRow,
  type AdminPaymentReportQuery,
  type AdminPaymentReportStatusRow,
  type AdminPaymentReportWorkspaceRow,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

@Injectable()
export class AdminPaymentReportService {
  constructor(private readonly database: DatabaseService) {}

  async report(query: unknown): Promise<AdminPaymentReport> {
    const filters = this.parse(adminPaymentReportQuerySchema.safeParse(query));
    const since = this.since(filters.range);
    const currencies = await this.currencies(filters, since);
    const currency = currencies[0] ?? 'USD';
    const scope = this.scope(filters, since, currency);
    const settledScope = and(scope, this.settledCondition())!;
    const [metrics, series, byProduct, byStatus, topWorkspaces] =
      await Promise.all([
        this.metrics(settledScope, scope),
        this.series(settledScope, filters.range),
        this.byProduct(settledScope),
        this.byStatus(scope),
        this.topWorkspaces(settledScope),
      ]);
    return {
      range: filters.range,
      productType: filters.productType,
      currency,
      currencies,
      metrics,
      series,
      byProduct,
      byStatus,
      topWorkspaces,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Fecha efectiva del cobro: el pago se imputa al día en que se liquidó. */
  private get settledAt() {
    return sql`coalesce(${billingPayments.paidAt}, ${billingPayments.createdAt})`;
  }

  private settledCondition() {
    return sql`${billingPayments.status} in ('paid', 'partially_refunded', 'refunded')`;
  }

  private since(range: AdminPaymentReportQuery['range']) {
    const now = new Date();
    if (range === '12m') {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
      );
      return start;
    }
    const days = range === '90d' ? 90 : 30;
    return new Date(now.getTime() - days * 86_400_000);
  }

  private scope(
    filters: AdminPaymentReportQuery,
    since: Date,
    currency?: string,
  ) {
    const conditions = [gte(billingPayments.createdAt, since)];
    if (filters.productType !== 'all')
      conditions.push(eq(billingPayments.productType, filters.productType));
    if (currency) conditions.push(eq(billingPayments.currency, currency));
    return and(...conditions)!;
  }

  /** La moneda dominante del periodo encabeza la lista y es la que se agrega. */
  private async currencies(filters: AdminPaymentReportQuery, since: Date) {
    const rows = await this.database.db
      .select({ currency: billingPayments.currency, total: count() })
      .from(billingPayments)
      .where(this.scope(filters, since))
      .groupBy(billingPayments.currency)
      .orderBy(desc(count()));
    return rows.map((row) => row.currency);
  }

  private async metrics(settledScope: SQL, scope: SQL) {
    const [settled] = await this.database.db
      .select({
        gross: sql<string>`coalesce(sum(${billingPayments.amountMinor}), 0)`,
        refunded: sql<string>`coalesce(sum(${billingPayments.refundedAmountMinor}), 0)`,
        total: count(),
      })
      .from(billingPayments)
      .where(settledScope);
    const [counts] = await this.database.db
      .select({
        paid: sql<string>`count(*) filter (where ${billingPayments.status} = 'paid')`,
        pending: sql<string>`count(*) filter (where ${billingPayments.status} = 'pending')`,
        failed: sql<string>`count(*) filter (where ${billingPayments.status} = 'failed')`,
        refunded: sql<string>`count(*) filter (where ${billingPayments.status} in ('refunded', 'partially_refunded'))`,
      })
      .from(billingPayments)
      .where(scope);
    const grossMinor = Number(settled?.gross ?? 0);
    const refundedMinor = Number(settled?.refunded ?? 0);
    const settledCount = Number(settled?.total ?? 0);
    return {
      grossMinor,
      refundedMinor,
      netMinor: grossMinor - refundedMinor,
      averageTicketMinor: settledCount
        ? Math.round(grossMinor / settledCount)
        : 0,
      paidCount: Number(counts?.paid ?? 0),
      pendingCount: Number(counts?.pending ?? 0),
      failedCount: Number(counts?.failed ?? 0),
      refundedCount: Number(counts?.refunded ?? 0),
    };
  }

  private async series(
    settledScope: SQL,
    range: AdminPaymentReportQuery['range'],
  ) {
    const unit = range === '12m' ? 'month' : 'day';
    const format = range === '12m' ? 'YYYY-MM' : 'YYYY-MM-DD';
    const bucket = sql<string>`to_char(date_trunc(${unit}, ${this.settledAt}), ${format})`;
    const rows = await this.database.db
      .select({
        period: bucket,
        gross: sql<string>`coalesce(sum(${billingPayments.amountMinor}), 0)`,
        refunded: sql<string>`coalesce(sum(${billingPayments.refundedAmountMinor}), 0)`,
        total: count(),
      })
      .from(billingPayments)
      .where(settledScope)
      .groupBy(bucket)
      .orderBy(bucket);
    return rows.map((row) => {
      const grossMinor = Number(row.gross);
      return {
        period: row.period,
        grossMinor,
        netMinor: grossMinor - Number(row.refunded),
        count: Number(row.total),
      };
    });
  }

  private async byProduct(
    settledScope: SQL,
  ): Promise<AdminPaymentReportProductRow[]> {
    const rows = await this.database.db
      .select({
        label: billingPayments.productLabel,
        productType: billingPayments.productType,
        gross: sql<string>`coalesce(sum(${billingPayments.amountMinor}), 0)`,
        total: count(),
      })
      .from(billingPayments)
      .where(settledScope)
      .groupBy(billingPayments.productLabel, billingPayments.productType)
      .orderBy(desc(sql`sum(${billingPayments.amountMinor})`))
      .limit(8);
    return rows.map((row) => ({
      label: row.label,
      productType: row.productType,
      grossMinor: Number(row.gross),
      count: Number(row.total),
    }));
  }

  private async byStatus(
    scope: SQL,
  ): Promise<AdminPaymentReportStatusRow[]> {
    const rows = await this.database.db
      .select({
        status: billingPayments.status,
        amount: sql<string>`coalesce(sum(${billingPayments.amountMinor}), 0)`,
        total: count(),
      })
      .from(billingPayments)
      .where(scope)
      .groupBy(billingPayments.status)
      .orderBy(desc(count()));
    return rows.map((row) => ({
      status: row.status,
      amountMinor: Number(row.amount),
      count: Number(row.total),
    }));
  }

  private async topWorkspaces(
    settledScope: SQL,
  ): Promise<AdminPaymentReportWorkspaceRow[]> {
    const rows = await this.database.db
      .select({
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        gross: sql<string>`coalesce(sum(${billingPayments.amountMinor}), 0)`,
        total: count(),
      })
      .from(billingPayments)
      .innerJoin(workspaces, eq(billingPayments.workspaceId, workspaces.id))
      .where(settledScope)
      .groupBy(workspaces.id, workspaces.name)
      .orderBy(desc(sql`sum(${billingPayments.amountMinor})`))
      .limit(5);
    return rows.map((row) => ({
      workspaceId: row.workspaceId,
      workspaceName: row.workspaceName,
      grossMinor: Number(row.gross),
      count: Number(row.total),
    }));
  }

  private parse<T>(result: { success: true; data: T } | { success: false }) {
    if (!result.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return result.data;
  }
}
