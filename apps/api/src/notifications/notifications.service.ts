import { HttpStatus, Injectable } from '@nestjs/common';
import {
  platformAnnouncementReads,
  platformAnnouncements,
} from '@workspace/database';
import { and, desc, eq, isNull, or, sql } from '@workspace/database/query';
import type { SQL } from '@workspace/database/query';
import {
  type PortalAuthSession,
  type PortalNotification,
  type PortalNotificationsResponse,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const FEED_LIMIT = 20;

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async feed(
    session: PortalAuthSession,
  ): Promise<PortalNotificationsResponse> {
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
    const notifications = rows.map(
      ({ announcement, readAt }): PortalNotification => ({
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        url: announcement.url,
        publishedAt: (
          announcement.publishedAt ?? announcement.createdAt
        ).toISOString(),
        readAt: readAt?.toISOString() ?? null,
      }),
    );
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
      .where(and(eq(platformAnnouncements.id, id), this.visibleCondition(session)))
      .limit(1);
    if (!visible) throw this.notFound();
    await this.upsertState(session.user.id, [visible.id], { read: true });
    return this.feed(session);
  }

  async markAllRead(
    session: PortalAuthSession,
  ): Promise<PortalNotificationsResponse> {
    const ids = await this.visibleIds(session);
    await this.upsertState(session.user.id, ids, { read: true });
    return this.feed(session);
  }

  async archiveAll(
    session: PortalAuthSession,
  ): Promise<PortalNotificationsResponse> {
    const ids = await this.visibleIds(session);
    await this.upsertState(session.user.id, ids, { read: true, archive: true });
    return this.feed(session);
  }

  /**
   * Un anuncio es visible si está publicado y su audiencia alcanza al workspace
   * activo o a la persona de la sesión. No hay lectura entre workspaces.
   */
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
    state: { read?: boolean; archive?: boolean },
  ) {
    if (!announcementIds.length) return;
    const now = new Date();
    await this.database.db
      .insert(platformAnnouncementReads)
      .values(
        announcementIds.map((announcementId) => ({
          announcementId,
          userId,
          readAt: state.read ? now : null,
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
        set: {
          readAt: state.read
            ? sql`coalesce(${platformAnnouncementReads.readAt}, ${now})`
            : platformAnnouncementReads.readAt,
          archivedAt: state.archive
            ? now
            : platformAnnouncementReads.archivedAt,
          updatedAt: now,
        },
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
