import { HttpStatus, Injectable } from '@nestjs/common';
import {
  platformAnnouncementReads,
  platformAnnouncements,
  workspaceNotifications,
} from '@workspace/database';
import { and, desc, eq, isNull, or, sql } from '@workspace/database/query';
import type { SQL } from '@workspace/database/query';
import {
  type PortalAuthSession,
  type PortalNotification,
  type WorkspaceNotificationKind,
  type PortalNotificationsResponse,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const FEED_LIMIT = 20;

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async feed(session: PortalAuthSession): Promise<PortalNotificationsResponse> {
    const rows = await this.database.db
      .select({
        announcement: platformAnnouncements,
        readAt: platformAnnouncementReads.readAt,
      })
      .from(platformAnnouncements)
      .leftJoin(
        platformAnnouncementReads,
        and(
          eq(
            platformAnnouncementReads.announcementId,
            platformAnnouncements.id,
          ),
          eq(platformAnnouncementReads.userId, session.user.id),
        ),
      )
      .where(
        and(
          this.visibleCondition(session),
          isNull(platformAnnouncementReads.archivedAt),
        ),
      )
      .orderBy(desc(platformAnnouncements.publishedAt))
      .limit(FEED_LIMIT);
    const workspaceRows = await this.database.db
      .select()
      .from(workspaceNotifications)
      .where(
        and(
          eq(workspaceNotifications.userId, session.user.id),
          eq(workspaceNotifications.workspaceId, session.workspace.id),
          isNull(workspaceNotifications.archivedAt),
        ),
      )
      .orderBy(desc(workspaceNotifications.createdAt))
      .limit(FEED_LIMIT);

    const notifications: PortalNotification[] = [
      ...rows.map(({ announcement, readAt }): PortalNotification => ({
        source: 'announcement',
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        url: announcement.url,
        publishedAt: (
          announcement.publishedAt ?? announcement.createdAt
        ).toISOString(),
        readAt: readAt?.toISOString() ?? null,
      })),
      ...workspaceRows.map((row): PortalNotification => ({
        source: 'workspace',
        id: row.id,
        kind: row.kind as WorkspaceNotificationKind,
        payload: row.payload,
        url: row.url,
        publishedAt: row.createdAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
      })),
    ]
      .sort((first, second) =>
        second.publishedAt.localeCompare(first.publishedAt),
      )
      .slice(0, FEED_LIMIT);
    return {
      notifications,
      unread: notifications.filter((item) => !item.readAt).length,
    };
  }

  async markRead(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalNotificationsResponse> {
    if (!this.isUuid(id)) throw this.notFound();
    const [visible] = await this.database.db
      .select({ id: platformAnnouncements.id })
      .from(platformAnnouncements)
      .where(
        and(eq(platformAnnouncements.id, id), this.visibleCondition(session)),
      )
      .limit(1);
    if (visible) {
      await this.upsertState(session.user.id, [visible.id]);
      return this.feed(session);
    }

    const marked = await this.database.db
      .update(workspaceNotifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(workspaceNotifications.id, id),
          eq(workspaceNotifications.userId, session.user.id),
          isNull(workspaceNotifications.readAt),
        ),
      )
      .returning({ id: workspaceNotifications.id });
    if (!marked.length) throw this.notFound();
    return this.feed(session);
  }

  async markAllRead(
    session: PortalAuthSession,
  ): Promise<PortalNotificationsResponse> {
    const ids = await this.visibleIds(session);
    await Promise.all([
      this.upsertState(session.user.id, ids),
      this.database.db
        .update(workspaceNotifications)
        .set({ readAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(workspaceNotifications.userId, session.user.id),
            eq(workspaceNotifications.workspaceId, session.workspace.id),
            isNull(workspaceNotifications.readAt),
          ),
        ),
    ]);
    return this.feed(session);
  }

  async archiveAll(
    session: PortalAuthSession,
  ): Promise<PortalNotificationsResponse> {
    const ids = await this.visibleIds(session);
    const now = new Date();
    await Promise.all([
      this.upsertState(session.user.id, ids, { archive: true }),
      this.database.db
        .update(workspaceNotifications)
        .set({ readAt: now, archivedAt: now, updatedAt: now })
        .where(
          and(
            eq(workspaceNotifications.userId, session.user.id),
            eq(workspaceNotifications.workspaceId, session.workspace.id),
            isNull(workspaceNotifications.archivedAt),
          ),
        ),
    ]);
    return this.feed(session);
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

  private async visibleIds(session: PortalAuthSession) {
    const rows = await this.database.db
      .select({ id: platformAnnouncements.id })
      .from(platformAnnouncements)
      .where(this.visibleCondition(session));
    return rows.map((row) => row.id);
  }

  private async upsertState(
    userId: string,
    announcementIds: string[],
    state: { archive?: boolean } = {},
  ) {
    if (!announcementIds.length) return;
    const now = new Date();
    const readAt = sql`coalesce(${platformAnnouncementReads.readAt}, now())`;
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
          ? { readAt, archivedAt: now, updatedAt: now }
          : { readAt, updatedAt: now },
      });
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private notFound() {
    return new AppException('ANNOUNCEMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}
