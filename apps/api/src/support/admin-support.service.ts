import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  supportCategories,
  supportTicketComments,
  supportTickets,
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
  isNull,
  lt,
  or,
  sql,
} from '@workspace/database/query';
import {
  adminSupportTicketsQuerySchema,
  createAdminSupportReplySchema,
  updateAdminSupportTicketStatusSchema,
  type AdminSupportCategory,
  type AdminSupportMetrics,
  type AdminSupportTicket,
  type AdminSupportTicketComment,
  type AdminSupportTicketDetail,
  type AdminSupportTicketsResponse,
  type PlatformAdminAuthSession,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

type TicketRow = {
  ticket: typeof supportTickets.$inferSelect;
  category: typeof supportCategories.$inferSelect;
  workspace: { id: string; name: string };
  requester: { id: string; displayName: string; email: string };
};

@Injectable()
export class AdminSupportService {
  constructor(private readonly database: DatabaseService) {}

  /** Un caso espera al equipo cuando sigue abierto y su última actividad no fue leída por soporte. */
  private readonly awaitingCondition = or(
    isNull(supportTickets.supportLastReadAt),
    lt(supportTickets.supportLastReadAt, supportTickets.lastActivityAt),
  )!;

  async list(query: unknown): Promise<AdminSupportTicketsResponse> {
    const filters = this.parse(adminSupportTicketsQuerySchema.safeParse(query));
    const conditions = [];
    if (filters.status !== 'all')
      conditions.push(eq(supportTickets.status, filters.status));
    if (filters.categoryId)
      conditions.push(eq(supportTickets.categoryId, filters.categoryId));
    if (filters.awaitingReply)
      conditions.push(
        and(eq(supportTickets.status, 'open'), this.awaitingCondition)!,
      );
    if (filters.q) {
      const value = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(supportTickets.subject, value),
          ilike(supportTickets.description, value),
          ilike(users.displayName, value),
          ilike(users.email, value),
          ilike(workspaces.name, value),
        )!,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.limit;
    const [rows, totalRows, metrics, categories] = await Promise.all([
      this.baseQuery()
        .where(where)
        .orderBy(desc(supportTickets.lastActivityAt), desc(supportTickets.id))
        .limit(filters.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(supportTickets)
        .innerJoin(users, eq(supportTickets.requesterUserId, users.id))
        .innerJoin(workspaces, eq(supportTickets.workspaceId, workspaces.id))
        .where(where),
      this.metrics(),
      this.categories(),
    ]);
    const commentCounts = await this.commentCounts(
      rows.map((row) => row.ticket.id),
    );
    return {
      tickets: rows.map((row) =>
        this.serializeTicket(row, commentCounts.get(row.ticket.id) ?? 0),
      ),
      categories,
      metrics,
      page: filters.page,
      limit: filters.limit,
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  /** Abrir el detalle marca el caso como leído por soporte. */
  async get(id: string): Promise<AdminSupportTicketDetail> {
    const row = await this.find(id);
    const now = new Date();
    const [comments] = await Promise.all([
      this.commentsFor(row.ticket.id),
      this.database.db
        .update(supportTickets)
        .set({ supportLastReadAt: now, updatedAt: now })
        .where(eq(supportTickets.id, row.ticket.id)),
    ]);
    return {
      ...this.serializeTicket(
        { ...row, ticket: { ...row.ticket, supportLastReadAt: now } },
        comments.length,
      ),
      description: row.ticket.description,
      comments,
    };
  }

  async reply(
    session: PlatformAdminAuthSession,
    id: string,
    input: unknown,
  ): Promise<AdminSupportTicketDetail> {
    const values = this.parse(createAdminSupportReplySchema.safeParse(input));
    const row = await this.find(id);
    if (row.ticket.status === 'closed') throw this.closed();
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx.insert(supportTicketComments).values({
        supportTicketId: row.ticket.id,
        workspaceId: row.ticket.workspaceId,
        authorUserId: session.user.id,
        authorRole: 'support',
        body: values.body,
        createdAt: now,
        updatedAt: now,
      });
      await tx
        .update(supportTickets)
        .set({
          supportLastReadAt: now,
          requesterLastReadAt: null,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(supportTickets.id, row.ticket.id));
      await tx.insert(apiAuditLogs).values({
        workspaceId: row.ticket.workspaceId,
        actorUserId: session.user.id,
        event: 'support_ticket.support_replied',
        subjectType: 'support_ticket',
        subjectId: row.ticket.id,
        summary: 'Support replied to a ticket',
        metadata: {},
      });
    });
    return this.get(row.ticket.id);
  }

  async setStatus(
    session: PlatformAdminAuthSession,
    id: string,
    input: unknown,
  ): Promise<AdminSupportTicketDetail> {
    const values = this.parse(
      updateAdminSupportTicketStatusSchema.safeParse(input),
    );
    const row = await this.find(id);
    if (row.ticket.status === values.status) return this.get(row.ticket.id);
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(supportTickets)
        .set({
          status: values.status,
          resolvedAt: values.status === 'resolved' ? now : null,
          supportLastReadAt: now,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(supportTickets.id, row.ticket.id));
      await tx.insert(apiAuditLogs).values({
        workspaceId: row.ticket.workspaceId,
        actorUserId: session.user.id,
        event: `support_ticket.${values.status}`,
        subjectType: 'support_ticket',
        subjectId: row.ticket.id,
        summary: `Support ticket marked as ${values.status}`,
        metadata: { previousStatus: row.ticket.status },
      });
    });
    return this.get(row.ticket.id);
  }

  private baseQuery() {
    return this.database.db
      .select({
        ticket: supportTickets,
        category: supportCategories,
        workspace: { id: workspaces.id, name: workspaces.name },
        requester: {
          id: users.id,
          displayName: users.displayName,
          email: users.email,
        },
      })
      .from(supportTickets)
      .innerJoin(
        supportCategories,
        eq(supportTickets.categoryId, supportCategories.id),
      )
      .innerJoin(users, eq(supportTickets.requesterUserId, users.id))
      .innerJoin(workspaces, eq(supportTickets.workspaceId, workspaces.id))
      .$dynamic();
  }

  private async find(id: string): Promise<TicketRow> {
    if (!this.isUuid(id)) throw this.notFound();
    const [row] = await this.baseQuery()
      .where(eq(supportTickets.id, id))
      .limit(1);
    if (!row) throw this.notFound();
    return row;
  }

  private async metrics(): Promise<AdminSupportMetrics> {
    const [row] = await this.database.db
      .select({
        open: sql<number>`count(*) filter (where ${supportTickets.status} = 'open')`,
        resolved: sql<number>`count(*) filter (where ${supportTickets.status} = 'resolved')`,
        closed: sql<number>`count(*) filter (where ${supportTickets.status} = 'closed')`,
        awaitingReply: sql<number>`count(*) filter (where ${supportTickets.status} = 'open' and (${supportTickets.supportLastReadAt} is null or ${supportTickets.supportLastReadAt} < ${supportTickets.lastActivityAt}))`,
      })
      .from(supportTickets);
    return {
      open: Number(row?.open ?? 0),
      resolved: Number(row?.resolved ?? 0),
      closed: Number(row?.closed ?? 0),
      awaitingReply: Number(row?.awaitingReply ?? 0),
    };
  }

  private async categories(): Promise<AdminSupportCategory[]> {
    const rows = await this.database.db
      .select()
      .from(supportCategories)
      .orderBy(asc(supportCategories.name));
    return rows.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      status: category.status,
    }));
  }

  private async commentsFor(
    ticketId: string,
  ): Promise<AdminSupportTicketComment[]> {
    const rows = await this.database.db
      .select({ comment: supportTicketComments, author: users })
      .from(supportTicketComments)
      .innerJoin(users, eq(supportTicketComments.authorUserId, users.id))
      .where(eq(supportTicketComments.supportTicketId, ticketId))
      .orderBy(
        asc(supportTicketComments.createdAt),
        asc(supportTicketComments.id),
      );
    return rows.map(({ comment, author }) => ({
      id: comment.id,
      authorName: author.displayName,
      authorRole: comment.authorRole,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    }));
  }

  private async commentCounts(ticketIds: string[]) {
    const counts = new Map<string, number>();
    if (!ticketIds.length) return counts;
    const rows = await this.database.db
      .select({
        ticketId: supportTicketComments.supportTicketId,
        total: count(),
      })
      .from(supportTicketComments)
      .where(inArray(supportTicketComments.supportTicketId, ticketIds))
      .groupBy(supportTicketComments.supportTicketId);
    for (const row of rows) counts.set(row.ticketId, Number(row.total));
    return counts;
  }

  private serializeTicket(
    row: TicketRow,
    commentCount: number,
  ): AdminSupportTicket {
    const { ticket, category, workspace, requester } = row;
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        status: category.status,
      },
      workspace,
      requester,
      commentCount,
      awaitingReply:
        ticket.status === 'open' &&
        (ticket.supportLastReadAt === null ||
          ticket.supportLastReadAt < ticket.lastActivityAt),
      lastActivityAt: ticket.lastActivityAt.toISOString(),
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      createdAt: ticket.createdAt.toISOString(),
    };
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
    return new AppException('SUPPORT_TICKET_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  private closed() {
    return new AppException('SUPPORT_TICKET_NOT_OPEN', HttpStatus.CONFLICT);
  }
}
