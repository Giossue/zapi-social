import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  platformAnnouncementReads,
  platformAnnouncements,
  users,
  workspaces,
} from '@workspace/database';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from '@workspace/database/query';
import {
  adminAnnouncementsQuerySchema,
  adminAnnouncementTargetsQuerySchema,
  upsertAdminAnnouncementSchema,
  type AdminAnnouncement,
  type AdminAnnouncementMetrics,
  type AdminAnnouncementsResponse,
  type AdminAnnouncementTargets,
  type PlatformAdminAuthSession,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

type Announcement = typeof platformAnnouncements.$inferSelect;

@Injectable()
export class AdminNotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: unknown): Promise<AdminAnnouncementsResponse> {
    const filters = this.parse(adminAnnouncementsQuerySchema.safeParse(query));
    const conditions = [];
    if (filters.status !== 'all')
      conditions.push(eq(platformAnnouncements.status, filters.status));
    if (filters.q) {
      const value = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(platformAnnouncements.title, value),
          ilike(platformAnnouncements.body, value),
        )!,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.limit;
    const [rows, totalRows, metrics] = await Promise.all([
      this.database.db
        .select({
          announcement: platformAnnouncements,
          workspaceName: workspaces.name,
          targetUserName: sql<string | null>`target_user.display_name`,
          authorName: sql<string | null>`author.display_name`,
        })
        .from(platformAnnouncements)
        .leftJoin(
          workspaces,
          eq(platformAnnouncements.targetWorkspaceId, workspaces.id),
        )
        .leftJoin(
          sql`${users} as target_user`,
          sql`target_user.id = ${platformAnnouncements.targetUserId}`,
        )
        .leftJoin(
          sql`${users} as author`,
          sql`author.id = ${platformAnnouncements.createdByUserId}`,
        )
        .where(where)
        .orderBy(desc(platformAnnouncements.createdAt))
        .limit(filters.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(platformAnnouncements)
        .where(where),
      this.metrics(),
    ]);
    const reads = await this.readCounts(rows.map((row) => row.announcement.id));
    return {
      announcements: rows.map((row) =>
        this.serialize(
          row.announcement,
          row.workspaceName ?? row.targetUserName ?? null,
          row.authorName ?? null,
          reads.get(row.announcement.id) ?? 0,
        ),
      ),
      metrics,
      page: filters.page,
      limit: filters.limit,
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async create(
    session: PlatformAdminAuthSession,
    input: unknown,
  ): Promise<AdminAnnouncement> {
    const values = this.parse(upsertAdminAnnouncementSchema.safeParse(input));
    const now = new Date();
    const [created] = await this.database.db
      .insert(platformAnnouncements)
      .values({
        title: values.title,
        body: values.body,
        url: values.url ? values.url : null,
        audience: values.audience,
        targetWorkspaceId:
          values.audience === 'workspace'
            ? (values.targetWorkspaceId ?? null)
            : null,
        targetUserId:
          values.audience === 'user' ? (values.targetUserId ?? null) : null,
        status: values.publish ? 'published' : 'draft',
        publishedAt: values.publish ? now : null,
        createdByUserId: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!created) throw this.failed();
    await this.audit(session, created, 'platform_announcement.created');
    return this.hydrate(created);
  }

  async update(
    session: PlatformAdminAuthSession,
    id: string,
    input: unknown,
  ): Promise<AdminAnnouncement> {
    const values = this.parse(upsertAdminAnnouncementSchema.safeParse(input));
    const current = await this.find(id);
    const now = new Date();
    const [updated] = await this.database.db
      .update(platformAnnouncements)
      .set({
        title: values.title,
        body: values.body,
        url: values.url ? values.url : null,
        audience: values.audience,
        targetWorkspaceId:
          values.audience === 'workspace'
            ? (values.targetWorkspaceId ?? null)
            : null,
        targetUserId:
          values.audience === 'user' ? (values.targetUserId ?? null) : null,
        status: values.publish ? 'published' : 'draft',
        publishedAt: values.publish ? (current.publishedAt ?? now) : null,
        updatedAt: now,
      })
      .where(eq(platformAnnouncements.id, current.id))
      .returning();
    if (!updated) throw this.notFound();
    await this.audit(session, updated, 'platform_announcement.updated');
    return this.hydrate(updated);
  }

  async remove(
    session: PlatformAdminAuthSession,
    id: string,
  ): Promise<{ id: string }> {
    const current = await this.find(id);
    await this.database.db
      .delete(platformAnnouncements)
      .where(eq(platformAnnouncements.id, current.id));
    await this.audit(session, current, 'platform_announcement.deleted');
    return { id: current.id };
  }

  async targets(query: unknown): Promise<AdminAnnouncementTargets> {
    const filters = this.parse(
      adminAnnouncementTargetsQuerySchema.safeParse(query),
    );
    const term = filters.q ? `%${filters.q}%` : null;
    const [workspaceRows, userRows] = await Promise.all([
      this.database.db
        .select({ id: workspaces.id, label: workspaces.name })
        .from(workspaces)
        .where(term ? ilike(workspaces.name, term) : undefined)
        .orderBy(asc(workspaces.name))
        .limit(10),
      this.database.db
        .select({
          id: users.id,
          label: sql<string>`${users.displayName} || ' · ' || ${users.email}`,
        })
        .from(users)
        .where(
          term
            ? or(ilike(users.displayName, term), ilike(users.email, term))
            : undefined,
        )
        .orderBy(asc(users.displayName))
        .limit(10),
    ]);
    return { workspaces: workspaceRows, users: userRows };
  }

  private async metrics(): Promise<AdminAnnouncementMetrics> {
    const [row] = await this.database.db
      .select({
        published: sql<number>`count(*) filter (where ${platformAnnouncements.status} = 'published')`,
        drafts: sql<number>`count(*) filter (where ${platformAnnouncements.status} = 'draft')`,
        targeted: sql<number>`count(*) filter (where ${platformAnnouncements.audience} <> 'all')`,
      })
      .from(platformAnnouncements);
    const [reads] = await this.database.db
      .select({ total: count() })
      .from(platformAnnouncementReads)
      .where(sql`${platformAnnouncementReads.readAt} is not null`);
    return {
      published: Number(row?.published ?? 0),
      drafts: Number(row?.drafts ?? 0),
      targeted: Number(row?.targeted ?? 0),
      reads: Number(reads?.total ?? 0),
    };
  }

  private async readCounts(ids: string[]) {
    const counts = new Map<string, number>();
    if (!ids.length) return counts;
    const rows = await this.database.db
      .select({
        announcementId: platformAnnouncementReads.announcementId,
        total: count(),
      })
      .from(platformAnnouncementReads)
      .where(
        and(
          inArray(platformAnnouncementReads.announcementId, ids),
          sql`${platformAnnouncementReads.readAt} is not null`,
        ),
      )
      .groupBy(platformAnnouncementReads.announcementId);
    for (const row of rows) counts.set(row.announcementId, Number(row.total));
    return counts;
  }

  private async find(id: string): Promise<Announcement> {
    if (!this.isUuid(id)) throw this.notFound();
    const [row] = await this.database.db
      .select()
      .from(platformAnnouncements)
      .where(eq(platformAnnouncements.id, id))
      .limit(1);
    if (!row) throw this.notFound();
    return row;
  }

  private async hydrate(row: Announcement): Promise<AdminAnnouncement> {
    let targetLabel: string | null = null;
    if (row.targetWorkspaceId) {
      const [workspace] = await this.database.db
        .select({ name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, row.targetWorkspaceId))
        .limit(1);
      targetLabel = workspace?.name ?? null;
    } else if (row.targetUserId) {
      const [user] = await this.database.db
        .select({ name: users.displayName })
        .from(users)
        .where(eq(users.id, row.targetUserId))
        .limit(1);
      targetLabel = user?.name ?? null;
    }
    const reads = await this.readCounts([row.id]);
    return this.serialize(row, targetLabel, null, reads.get(row.id) ?? 0);
  }

  private serialize(
    row: Announcement,
    targetLabel: string | null,
    createdByName: string | null,
    readCount: number,
  ): AdminAnnouncement {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      url: row.url,
      audience: row.audience,
      targetLabel,
      targetWorkspaceId: row.targetWorkspaceId,
      targetUserId: row.targetUserId,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdByName,
      readCount,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async audit(
    session: PlatformAdminAuthSession,
    row: Announcement,
    event: string,
  ) {
    await this.database.db.insert(apiAuditLogs).values({
      workspaceId: row.targetWorkspaceId,
      actorUserId: session.user.id,
      event,
      subjectType: 'platform_announcement',
      subjectId: row.id,
      summary: row.title,
      metadata: { audience: row.audience, status: row.status },
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
    return new AppException('ANNOUNCEMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  private failed() {
    return new AppException('REQUEST_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
