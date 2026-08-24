import { HttpStatus, Injectable } from '@nestjs/common';
import {
  platformAnnouncementReads,
  platformAnnouncements,
  workspaceNotifications,
} from '@workspace/database';
import {
  and,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  or,
  sql,
} from '@workspace/database/query';
import type { SQL } from '@workspace/database/query';
import {
  type PortalAuthSession,
  type PortalNotification,
  type PortalNotificationsFilter,
  type WorkspaceNotificationKind,
  type PortalNotificationsResponse,
  portalNotificationIdSchema,
  portalNotificationsQuerySchema,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const FEED_LIMIT = 10;

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async feed(
    session: PortalAuthSession,
    query: unknown = {},
  ): Promise<PortalNotificationsResponse> {
    const filters = this.parse(portalNotificationsQuerySchema.safeParse(query));
    const fetchLimit = filters.page * filters.limit;
    const announcementWhere = and(
      this.visibleCondition(session),
      this.announcementStateCondition(filters.filter),
    );
    const workspaceWhere = and(
      eq(workspaceNotifications.userId, session.user.id),
      eq(workspaceNotifications.workspaceId, session.workspace.id),
      this.workspaceStateCondition(filters.filter),
    );
    const announcementJoin = and(
      eq(platformAnnouncementReads.announcementId, platformAnnouncements.id),
      eq(platformAnnouncementReads.userId, session.user.id),
    );
    const [
      rows,
      workspaceRows,
      announcementTotalRows,
      workspaceTotalRows,
      announcementUnreadRows,
      workspaceUnreadRows,
    ] = await Promise.all([
      this.database.db
        .select({
          announcement: platformAnnouncements,
          readAt: platformAnnouncementReads.readAt,
          archivedAt: platformAnnouncementReads.archivedAt,
        })
        .from(platformAnnouncements)
        .leftJoin(platformAnnouncementReads, announcementJoin)
        .where(announcementWhere)
        .orderBy(desc(platformAnnouncements.publishedAt))
        .limit(fetchLimit),
      this.database.db
        .select()
        .from(workspaceNotifications)
        .where(workspaceWhere)
        .orderBy(desc(workspaceNotifications.createdAt))
        .limit(fetchLimit),
      this.database.db
        .select({ total: count() })
        .from(platformAnnouncements)
        .leftJoin(platformAnnouncementReads, announcementJoin)
        .where(announcementWhere),
      this.database.db
        .select({ total: count() })
        .from(workspaceNotifications)
        .where(workspaceWhere),
      this.database.db
        .select({ total: count() })
        .from(platformAnnouncements)
        .leftJoin(platformAnnouncementReads, announcementJoin)
        .where(
          and(
            this.visibleCondition(session),
            isNull(platformAnnouncementReads.readAt),
            isNull(platformAnnouncementReads.archivedAt),
          ),
        ),
      this.database.db
        .select({ total: count() })
        .from(workspaceNotifications)
        .where(
          and(
            eq(workspaceNotifications.userId, session.user.id),
            eq(workspaceNotifications.workspaceId, session.workspace.id),
            isNull(workspaceNotifications.readAt),
            isNull(workspaceNotifications.archivedAt),
          ),
        ),
    ]);

    const notifications: PortalNotification[] = [
      ...rows.map(
        ({ announcement, readAt, archivedAt }): PortalNotification => ({
          source: 'announcement',
          id: announcement.id,
          title: announcement.title,
          body: announcement.body,
          url: announcement.url,
          publishedAt: (
            announcement.publishedAt ?? announcement.createdAt
          ).toISOString(),
          readAt: readAt?.toISOString() ?? null,
          archivedAt: archivedAt?.toISOString() ?? null,
        }),
      ),
      ...workspaceRows.map((row): PortalNotification => ({
        source: 'workspace',
        id: row.id,
        kind: row.kind as WorkspaceNotificationKind,
        payload: row.payload,
        url: row.url,
        publishedAt: row.createdAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
        archivedAt: row.archivedAt?.toISOString() ?? null,
      })),
    ]
      .sort((first, second) =>
        second.publishedAt.localeCompare(first.publishedAt),
      )
      .slice((filters.page - 1) * filters.limit, filters.page * filters.limit);
    return {
      notifications,
      unread:
        Number(announcementUnreadRows[0]?.total ?? 0) +
        Number(workspaceUnreadRows[0]?.total ?? 0),
      page: filters.page,
      limit: filters.limit,
      total:
        Number(announcementTotalRows[0]?.total ?? 0) +
        Number(workspaceTotalRows[0]?.total ?? 0),
    };
  }

  async markRead(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalNotificationsResponse> {
    const id = this.parse(portalNotificationIdSchema.safeParse(input));
    const [visible] = await this.database.db
      .select({ id: platformAnnouncements.id })
      .from(platformAnnouncements)
      .where(
        and(eq(platformAnnouncements.id, id), this.visibleCondition(session)),
      )
      .limit(1);
    if (visible) {
      await this.upsertState(session.user.id, [visible.id]);
      return this.feed(session, { limit: FEED_LIMIT });
    }

    const [workspaceNotification] = await this.database.db
      .select({ id: workspaceNotifications.id })
      .from(workspaceNotifications)
      .where(
        and(
          eq(workspaceNotifications.id, id),
          eq(workspaceNotifications.userId, session.user.id),
          eq(workspaceNotifications.workspaceId, session.workspace.id),
        ),
      )
      .limit(1);
    if (!workspaceNotification) throw this.notFound();
    await this.database.db
      .update(workspaceNotifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(workspaceNotifications.id, id),
          eq(workspaceNotifications.userId, session.user.id),
          eq(workspaceNotifications.workspaceId, session.workspace.id),
          isNull(workspaceNotifications.readAt),
        ),
      );
    return this.feed(session, { limit: FEED_LIMIT });
  }

  async archive(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalNotificationsResponse> {
    const id = this.parse(portalNotificationIdSchema.safeParse(input));
    const [visible] = await this.database.db
      .select({ id: platformAnnouncements.id })
      .from(platformAnnouncements)
      .where(
        and(eq(platformAnnouncements.id, id), this.visibleCondition(session)),
      )
      .limit(1);
    if (visible) {
      await this.upsertState(session.user.id, [visible.id], { archive: true });
      return this.feed(session, { limit: FEED_LIMIT });
    }

    const [workspaceNotification] = await this.database.db
      .select({
        id: workspaceNotifications.id,
        archivedAt: workspaceNotifications.archivedAt,
      })
      .from(workspaceNotifications)
      .where(
        and(
          eq(workspaceNotifications.id, id),
          eq(workspaceNotifications.userId, session.user.id),
          eq(workspaceNotifications.workspaceId, session.workspace.id),
        ),
      )
      .limit(1);
    if (!workspaceNotification) throw this.notFound();
    if (!workspaceNotification.archivedAt) {
      const now = new Date();
      await this.database.db
        .update(workspaceNotifications)
        .set({ readAt: now, archivedAt: now, updatedAt: now })
        .where(
          and(
            eq(workspaceNotifications.id, id),
            eq(workspaceNotifications.userId, session.user.id),
            eq(workspaceNotifications.workspaceId, session.workspace.id),
            isNull(workspaceNotifications.archivedAt),
          ),
        );
    }
    return this.feed(session, { limit: FEED_LIMIT });
  }

  private announcementStateCondition(filter: PortalNotificationsFilter): SQL {
    if (filter === 'archived')
      return isNotNull(platformAnnouncementReads.archivedAt);
    if (filter === 'unread')
      return and(
        isNull(platformAnnouncementReads.readAt),
        isNull(platformAnnouncementReads.archivedAt),
      )!;
    if (filter === 'read')
      return and(
        isNotNull(platformAnnouncementReads.readAt),
        isNull(platformAnnouncementReads.archivedAt),
      )!;
    return isNull(platformAnnouncementReads.archivedAt);
  }

  private workspaceStateCondition(filter: PortalNotificationsFilter): SQL {
    if (filter === 'archived')
      return isNotNull(workspaceNotifications.archivedAt);
    if (filter === 'unread')
      return and(
        isNull(workspaceNotifications.readAt),
        isNull(workspaceNotifications.archivedAt),
      )!;
    if (filter === 'read')
      return and(
        isNotNull(workspaceNotifications.readAt),
        isNull(workspaceNotifications.archivedAt),
      )!;
    return isNull(workspaceNotifications.archivedAt);
  }

  private visibleCondition(session: PortalAuthSession): SQL {
    return and(
      eq(platformAnnouncements.status, 'published'),
      or(
        eq(platformAnnouncements.audience, 'all'),
        and(
          eq(platformAnnouncements.audience, 'workspace'),
          eq(platformAnnouncements.targetWorkspaceId, session.workspace.id),
        ),
        and(
          eq(platformAnnouncements.audience, 'user'),
          eq(platformAnnouncements.targetUserId, session.user.id),
        ),
      ),
    )!;
  }

  private async upsertState(
    userId: string,
    announcementIds: string[],
    state: { archive?: boolean } = {},
  ) {
    if (!announcementIds.length) return;
    const now = new Date();
    const readAt = sql`coalesce(${platformAnnouncementReads.readAt}, now())`;
    const archivedAt = sql`coalesce(${platformAnnouncementReads.archivedAt}, now())`;
    await this.database.db
      .insert(platformAnnouncementReads)
      .values(
        announcementIds.map((announcementId) => ({
          announcementId,
          userId,
          readAt: now,
          archivedAt: state.archive ? now : null,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [
          platformAnnouncementReads.announcementId,
          platformAnnouncementReads.userId,
        ],
        set: state.archive
          ? { readAt, archivedAt, updatedAt: now }
          : { readAt, updatedAt: now },
      });
  }

  private parse<T>(result: { success: true; data: T } | { success: false }) {
    if (!result.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return result.data;
  }

  private notFound() {
    return new AppException('ANNOUNCEMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}
