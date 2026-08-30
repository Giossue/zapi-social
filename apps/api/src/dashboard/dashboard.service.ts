import { Injectable } from '@nestjs/common';
import {
  aiRequests,
  publishingPosts,
  socialAccounts,
} from '@workspace/database';
import type { PortalAuthSession, PortalDashboard } from '@workspace/contracts';
import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  lte,
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

const publishingStatusKeys = [
  'draft',
  'scheduled',
  'processing',
  'published',
  'failed',
] as const;

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  async getDashboard(session: PortalAuthSession): Promise<PortalDashboard> {
    const db = this.database.db;
    const workspaceId = session.workspace.id;
    const { currentStart, previousStart } = windowStarts();
    const now = new Date();
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const publishedDay = sql<string>`to_char(date_trunc('day', ${publishingPosts.publishedAt}), 'YYYY-MM-DD')`;
    const requestDay = sql<string>`to_char(date_trunc('day', ${aiRequests.createdAt}), 'YYYY-MM-DD')`;
    const channelKey = sql<string>`case
      when ${socialAccounts.capabilityKey} = 'facebook_page' then 'facebook'
      when ${socialAccounts.capabilityKey} = 'instagram_profile' then 'instagram'
      when ${socialAccounts.capabilityKey} = 'whatsapp_status' then 'whatsapp'
      else ${socialAccounts.providerKey}
    end`;

    const [
      publishedByDay,
      channelTotals,
      creditRows,
      requestsByDay,
      requestKinds,
      publishingStatusRows,
      publishingSourceRows,
      scheduledSoonRows,
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
            isNull(socialAccounts.disconnectedAt),
          ),
        ),
      db
        .select({
          period: sql<string>`case when ${aiRequests.createdAt} >= ${currentStart.toISOString()}::timestamptz then 'current' else 'previous' end`,
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
            eq(aiRequests.workspaceId, workspaceId),
            eq(aiRequests.status, 'succeeded'),
            gte(aiRequests.createdAt, currentStart),
          ),
        )
        .groupBy(aiRequests.kind)
        .orderBy(desc(count())),
      db
        .select({ status: publishingPosts.status, value: count() })
        .from(publishingPosts)
        .where(eq(publishingPosts.workspaceId, workspaceId))
        .groupBy(publishingPosts.status),
      db
        .select({ key: publishingPosts.source, value: count() })
        .from(publishingPosts)
        .where(
          and(
            eq(publishingPosts.workspaceId, workspaceId),
            eq(publishingPosts.status, 'published'),
            gte(publishingPosts.publishedAt, currentStart),
          ),
        )
        .groupBy(publishingPosts.source)
        .orderBy(desc(count())),
      db
        .select({ value: count() })
        .from(publishingPosts)
        .where(
          and(
            eq(publishingPosts.workspaceId, workspaceId),
            eq(publishingPosts.status, 'scheduled'),
            gte(publishingPosts.scheduledAt, now),
            lte(publishingPosts.scheduledAt, nextDay),
          ),
        ),
      db
        .select({
          content: publishingPosts.content,
          provider: channelKey,
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
            eq(publishingPosts.status, 'scheduled'),
            gte(publishingPosts.scheduledAt, now),
          ),
        )
        .orderBy(publishingPosts.scheduledAt)
        .limit(5),
      db
        .select({
          content: publishingPosts.content,
          provider: channelKey,
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
    const activeChannels = channelTotals[0]?.value ?? 0;
    const scheduledSoon = scheduledSoonRows[0]?.value ?? 0;
    const publishingStatuses = new Map(
      publishingStatusRows.map((row) => [row.status, row.value]),
    );
    const drafts = publishingStatuses.get('draft') ?? 0;

    const aiKinds = requestKinds.slice(0, 4).map((row) => ({
      key: row.kind,
      count: row.value,
    }));

    const upcoming = [
      ...scheduledRows.map((row) => ({
        content: row.content,
        channelKey: row.provider ?? 'none',
        status: 'scheduled' as const,
        date: row.scheduledAt ? row.scheduledAt.toISOString() : null,
      })),
      ...draftRows.map((row) => ({
        content: row.content,
        channelKey: row.provider ?? 'none',
        status: 'draft' as const,
        date: null,
      })),
    ].slice(0, 5);

    return {
      metrics: [
        {
          key: 'publishedPosts' as const,
          value: String(currentPublished),
          change: buildKpiChange(currentPublished, previousPublished),
          descriptionKey: 'previousWeeks' as const,
        },
        {
          key: 'scheduledSoon' as const,
          value: String(scheduledSoon),
          change: null,
          descriptionKey: 'next24Hours' as const,
        },
        {
          key: 'drafts' as const,
          value: String(drafts),
          change: null,
          descriptionKey: 'needsCompletion' as const,
        },
        {
          key: 'activeChannels' as const,
          value: String(activeChannels),
          change: null,
          descriptionKey: 'readyToPublish' as const,
        },
      ],
      publishingActivity,
      publishingStatuses: publishingStatusKeys.map((status) => ({
        count: publishingStatuses.get(status) ?? 0,
        status,
      })),
      publishingSources: publishingSourceRows.map((row) => ({
        key: row.key,
        count: row.value,
      })),
      aiUsage: {
        creditsUsed: creditsCurrent,
        days: buildDayCounts(
          new Map(requestsByDay.map((row) => [row.day, row.value])),
          dayKeys(currentStart, DASHBOARD_WINDOW_DAYS),
        ),
        kinds: aiKinds,
      },
      upcoming,
    };
  }
}
