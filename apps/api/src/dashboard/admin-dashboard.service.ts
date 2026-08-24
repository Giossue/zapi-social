import { Injectable } from '@nestjs/common';
import {
  aiRequests,
  billingPayments,
  billingSubscriptions,
  plans,
  users,
  workspaces,
} from '@workspace/database';
import type { AdminDashboard } from '@workspace/contracts';
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  sql,
} from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';
import {
  buildComparisonSeries,
  buildDayCounts,
  buildKpiChange,
  dayKeys,
  DASHBOARD_WINDOW_DAYS,
  windowStarts,
} from './dashboard.shared';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly database: DatabaseService) {}

  async getDashboard(): Promise<AdminDashboard> {
    const db = this.database.db;
    const { currentStart, previousStart } = windowStarts();

    const userDay = sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`;
    const requestDay = sql<string>`to_char(date_trunc('day', ${aiRequests.createdAt}), 'YYYY-MM-DD')`;

    const [
      userTotals,
      usersByDay,
      workspaceTotals,
      workspacesByPeriod,
      activeSubscriptions,
      subscriptionsByPlan,
      revenueRows,
      requestsByDay,
      requestKinds,
      paymentRows,
    ] = await Promise.all([
      db.select({ value: count() }).from(users),
      db
        .select({ day: userDay, value: count() })
        .from(users)
        .where(gte(users.createdAt, previousStart))
        .groupBy(userDay),
      db.select({ value: count() }).from(workspaces),
      db
        .select({
          period: sql<string>`case when ${workspaces.createdAt} >= ${currentStart.toISOString()}::timestamptz then 'current' else 'previous' end`,
          value: count(),
        })
        .from(workspaces)
        .where(gte(workspaces.createdAt, previousStart))
        .groupBy(sql`1`),
      db
        .select({ value: count() })
        .from(billingSubscriptions)
        .where(inArray(billingSubscriptions.status, ['active', 'trialing'])),
      db
        .select({ label: plans.name, value: count() })
        .from(billingSubscriptions)
        .innerJoin(plans, eq(billingSubscriptions.planId, plans.id))
        .where(inArray(billingSubscriptions.status, ['active', 'trialing']))
        .groupBy(plans.name)
        .orderBy(desc(count())),
      db
        .select({
          period: sql<string>`case when ${billingPayments.paidAt} >= ${currentStart.toISOString()}::timestamptz then 'current' else 'previous' end`,
          value: sql<number>`coalesce(sum(${billingPayments.amountMinor} - ${billingPayments.refundedAmountMinor}), 0)::int`,
          currency: billingPayments.currency,
        })
        .from(billingPayments)
        .where(
          and(
            inArray(billingPayments.status, ['paid', 'partially_refunded']),
            gte(billingPayments.paidAt, previousStart),
          ),
        )
        .groupBy(sql`1`, billingPayments.currency),
      db
        .select({ day: requestDay, value: count() })
        .from(aiRequests)
        .where(
          and(
            eq(aiRequests.status, 'succeeded'),
            gte(aiRequests.createdAt, currentStart),
          ),
        )
        .groupBy(requestDay),
      db
        .select({ kind: aiRequests.kind, value: count() })
        .from(aiRequests)
        .where(
          and(
            eq(aiRequests.status, 'succeeded'),
            gte(aiRequests.createdAt, currentStart),
          ),
        )
        .groupBy(aiRequests.kind)
        .orderBy(desc(count())),
      db
        .select({
          product: billingPayments.productLabel,
          workspace: workspaces.name,
          status: billingPayments.status,
          amountMinor: billingPayments.amountMinor,
          currency: billingPayments.currency,
          paidAt: billingPayments.paidAt,
          createdAt: billingPayments.createdAt,
        })
        .from(billingPayments)
        .innerJoin(workspaces, eq(billingPayments.workspaceId, workspaces.id))
        .orderBy(desc(billingPayments.createdAt))
        .limit(5),
    ]);

    const usersMap = new Map(usersByDay.map((row) => [row.day, row.value]));
    const userGrowth = buildComparisonSeries(
      usersMap,
      currentStart,
      previousStart,
    );
    const currentUsers = userGrowth.reduce(
      (total, point) => total + point.current,
      0,
    );
    const previousUsers = userGrowth.reduce(
      (total, point) => total + point.previous,
      0,
    );

    const workspacesCurrent =
      workspacesByPeriod.find((row) => row.period === 'current')?.value ?? 0;
    const workspacesPrevious =
      workspacesByPeriod.find((row) => row.period === 'previous')?.value ?? 0;

    const revenueCurrent = revenueRows
      .filter((row) => row.period === 'current')
      .reduce((total, row) => total + row.value, 0);
    const revenuePrevious = revenueRows
      .filter((row) => row.period === 'previous')
      .reduce((total, row) => total + row.value, 0);
    const revenueCurrency = revenueRows[0]?.currency ?? 'USD';
    const totalRequests = requestsByDay.reduce(
      (total, row) => total + row.value,
      0,
    );

    return {
      metrics: [
        {
          key: 'users' as const,
          value: String(userTotals[0]?.value ?? 0),
          currency: null,
          change: buildKpiChange(currentUsers, previousUsers),
          descriptionKey: 'usersPreviousWeeks' as const,
        },
        {
          key: 'workspaces' as const,
          value: String(workspaceTotals[0]?.value ?? 0),
          currency: null,
          change: buildKpiChange(workspacesCurrent, workspacesPrevious),
          descriptionKey: 'workspacesPreviousWeeks' as const,
        },
        {
          key: 'subscriptions' as const,
          value: String(activeSubscriptions[0]?.value ?? 0),
          currency: null,
          change: null,
          descriptionKey: 'activeOrTrial' as const,
        },
        {
          key: 'revenue' as const,
          value: String(revenueCurrent),
          currency: revenueCurrency,
          change: buildKpiChange(revenueCurrent, revenuePrevious),
          descriptionKey: 'chargedRecently' as const,
        },
      ],
      userGrowth,
      plans: subscriptionsByPlan.slice(0, 5).map((row) => ({
        key: row.label,
        count: row.value,
      })),
      aiActivity: {
        total: totalRequests,
        days: buildDayCounts(
          new Map(requestsByDay.map((row) => [row.day, row.value])),
          dayKeys(currentStart, DASHBOARD_WINDOW_DAYS),
        ),
        kinds: requestKinds.slice(0, 4).map((row) => ({
          key: row.kind,
          count: row.value,
        })),
      },
      recentPayments: paymentRows.map((row) => ({
        product: row.product,
        workspace: row.workspace,
        status: row.status,
        amountMinor: row.amountMinor,
        currency: row.currency,
        date: (row.paidAt ?? row.createdAt).toISOString(),
      })),
    };
  }
}
