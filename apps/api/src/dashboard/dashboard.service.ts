import { Injectable } from '@nestjs/common';
import {
  aiRequests,
  fileAssets,
  publishingPosts,
  socialAccounts,
} from '@workspace/database';
import type { PortalAuthSession, PortalDashboard } from '@workspace/contracts';
import { and, count, desc, eq, gte, inArray, ne, sql } from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';
import {
  aiKindLabel,
  buildComparisonSeries,
  buildDayCounts,
  buildKpiChange,
  dayKeys,
  DASHBOARD_WINDOW_DAYS,
  providerLabel,
  windowStarts,
} from './dashboard.shared';

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  async getDashboard(session: PortalAuthSession): Promise<PortalDashboard> {
    const db = this.database.db;
    const workspaceId = session.workspace.id;
    const { currentStart, previousStart } = windowStarts();

    const publishedDay = sql<string>`to_char(date_trunc('day', ${publishingPosts.publishedAt}), 'YYYY-MM-DD')`;
    const requestDay = sql<string>`to_char(date_trunc('day', ${aiRequests.createdAt}), 'YYYY-MM-DD')`;

    const [
      publishedByDay,
      channelTotals,
      recentChannels,
      creditRows,
      requestsByDay,
      requestKinds,
      filesRows,
      postsByProvider,
      scheduledRows,
      draftRows,
    ] = await Promise.all([
      db
        .select({ day: publishedDay, value: count() })
        .from(publishingPosts)
        .where(
          and(
            eq(publishingPosts.workspaceId, workspaceId),
            eq(publishingPosts.status, 'published'),
            gte(publishingPosts.publishedAt, previousStart),
          ),
        )
        .groupBy(publishedDay),
      db
        .select({ value: count() })
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.workspaceId, workspaceId),
            eq(socialAccounts.status, 'active'),
          ),
        ),
      db
        .select({ value: count() })
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.workspaceId, workspaceId),
            eq(socialAccounts.status, 'active'),
            gte(socialAccounts.connectedAt, currentStart),
          ),
        ),
      db
        .select({
          period: sql<string>`case when ${aiRequests.createdAt} >= ${currentStart} then 'current' else 'previous' end`,
          value: sql<number>`coalesce(sum(${aiRequests.costUnits}), 0)::int`,
        })
        .from(aiRequests)
        .where(
          and(
            eq(aiRequests.workspaceId, workspaceId),
            eq(aiRequests.status, 'succeeded'),
            gte(aiRequests.createdAt, previousStart),
          ),
        )
        .groupBy(sql`1`),
      db
        .select({ day: requestDay, value: count() })
        .from(aiRequests)
        .where(
          and(
            eq(aiRequests.workspaceId, workspaceId),
            gte(aiRequests.createdAt, currentStart),
          ),
        )
        .groupBy(requestDay),
      db
        .select({ kind: aiRequests.kind, value: count() })
        .from(aiRequests)
        .where(
          and(
            eq(aiRequests.workspaceId, workspaceId),
            gte(aiRequests.createdAt, currentStart),
          ),
        )
        .groupBy(aiRequests.kind)
        .orderBy(desc(count())),
      db
        .select({
          period: sql<string>`case when ${fileAssets.createdAt} >= ${currentStart} then 'current' else 'previous' end`,
          value: count(),
        })
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.workspaceId, workspaceId),
            ne(fileAssets.status, 'trashed'),
            gte(fileAssets.createdAt, previousStart),
          ),
        )
        .groupBy(sql`1`),
      db
        .select({ provider: socialAccounts.providerKey, value: count() })
        .from(publishingPosts)
        .innerJoin(
          socialAccounts,
          and(
            eq(publishingPosts.socialAccountId, socialAccounts.id),
            eq(socialAccounts.workspaceId, workspaceId),
          ),
        )
        .where(
          and(
            eq(publishingPosts.workspaceId, workspaceId),
            gte(publishingPosts.createdAt, currentStart),
          ),
        )
        .groupBy(socialAccounts.providerKey)
        .orderBy(desc(count())),
      db
        .select({
          content: publishingPosts.content,
          provider: socialAccounts.providerKey,
          scheduledAt: publishingPosts.scheduledAt,
        })
        .from(publishingPosts)
        .leftJoin(
          socialAccounts,
          and(
            eq(publishingPosts.socialAccountId, socialAccounts.id),
            eq(socialAccounts.workspaceId, workspaceId),
          ),
        )
        .where(
          and(
            eq(publishingPosts.workspaceId, workspaceId),
            inArray(publishingPosts.status, ['scheduled', 'processing']),
          ),
        )
        .orderBy(publishingPosts.scheduledAt)
        .limit(5),
      db
        .select({
          content: publishingPosts.content,
          provider: socialAccounts.providerKey,
        })
        .from(publishingPosts)
        .leftJoin(
          socialAccounts,
          and(
            eq(publishingPosts.socialAccountId, socialAccounts.id),
            eq(socialAccounts.workspaceId, workspaceId),
          ),
        )
        .where(
          and(
            eq(publishingPosts.workspaceId, workspaceId),
            eq(publishingPosts.status, 'draft'),
          ),
        )
        .orderBy(desc(publishingPosts.updatedAt))
        .limit(5),
    ]);

    const publishedMap = new Map(
      publishedByDay.map((row) => [row.day, row.value]),
    );
    const publishingActivity = buildComparisonSeries(
      publishedMap,
      currentStart,
      previousStart,
    );

    const currentPublished = publishingActivity.reduce(
      (total, point) => total + point.current,
      0,
    );
    const previousPublished = publishingActivity.reduce(
      (total, point) => total + point.previous,
      0,
    );

    const creditsCurrent =
      creditRows.find((row) => row.period === 'current')?.value ?? 0;
    const creditsPrevious =
      creditRows.find((row) => row.period === 'previous')?.value ?? 0;

    const filesCurrent =
      filesRows.find((row) => row.period === 'current')?.value ?? 0;
    const filesPrevious =
      filesRows.find((row) => row.period === 'previous')?.value ?? 0;

    const activeChannels = channelTotals[0]?.value ?? 0;
    const channelsConnected = recentChannels[0]?.value ?? 0;

    const aiKinds = requestKinds.slice(0, 4).map((row) => ({
      label: aiKindLabel(row.kind),
      count: row.value,
    }));

    const upcoming = [
      ...scheduledRows.map((row) => ({
        content: row.content,
        channel: providerLabel(row.provider),
        status: 'scheduled' as const,
        date: row.scheduledAt ? row.scheduledAt.toISOString() : null,
      })),
      ...draftRows.map((row) => ({
        content: row.content,
        channel: providerLabel(row.provider),
        status: 'draft' as const,
        date: null,
      })),
    ].slice(0, 5);

    return {
      metrics: [
        {
          label: 'Publicaciones',
          value: String(currentPublished),
          change: buildKpiChange(currentPublished, previousPublished),
          description: 'frente a las 4 semanas previas',
          icon: 'calendar',
        },
        {
          label: 'Canales activos',
          value: String(activeChannels),
          change:
            channelsConnected > 0
              ? { direction: 'up' as const, label: `+${channelsConnected}` }
              : null,
          description:
            channelsConnected > 0
              ? 'conectados en las últimas 4 semanas'
              : 'sin conexiones nuevas en 4 semanas',
          icon: 'channels',
        },
        {
          label: 'Créditos AI usados',
          value: String(creditsCurrent),
          change: buildKpiChange(creditsCurrent, creditsPrevious),
          description: 'frente a las 4 semanas previas',
          icon: 'ai',
        },
        {
          label: 'Archivos nuevos',
          value: String(filesCurrent),
          change: buildKpiChange(filesCurrent, filesPrevious),
          description: 'frente a las 4 semanas previas',
          icon: 'files',
        },
      ],
      publishingActivity,
      aiUsage: {
        creditsUsed: creditsCurrent,
        days: buildDayCounts(
          new Map(requestsByDay.map((row) => [row.day, row.value])),
          dayKeys(currentStart, DASHBOARD_WINDOW_DAYS),
        ),
        kinds: aiKinds,
      },
      channels: postsByProvider.slice(0, 5).map((row) => ({
        label: providerLabel(row.provider),
        count: row.value,
      })),
      aiTools: aiKinds,
      upcoming,
    };
  }
}
