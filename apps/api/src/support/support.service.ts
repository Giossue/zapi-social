import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  supportCategories,
  supportTicketComments,
  supportTickets,
  users,
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
} from '@workspace/database/query';
import {
  createPortalSupportTicketCommentSchema,
  createPortalSupportTicketSchema,
  portalSupportTicketsQuerySchema,
  type PortalAuthSession,
  type PortalSupportCategory,
  type PortalSupportTicket,
  type PortalSupportTicketComment,
  type PortalSupportTicketDetail,
  type PortalSupportTicketsResponse,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

type Ticket = typeof supportTickets.$inferSelect;
type Category = typeof supportCategories.$inferSelect;

@Injectable()
export class SupportService {
  constructor(private readonly database: DatabaseService) {}

  async categories(): Promise<PortalSupportCategory[]> {
    const rows = await this.database.db
      .select()
      .from(supportCategories)
      .where(eq(supportCategories.status, 'active'))
      .orderBy(asc(supportCategories.name));
    return rows.map((category) => this.serializeCategory(category));
  }

  async list(
    session: PortalAuthSession,
    query: unknown,
  ): Promise<PortalSupportTicketsResponse> {
    const filters = this.parse(
      portalSupportTicketsQuerySchema.safeParse(query),
    );
    const conditions = [
      eq(supportTickets.workspaceId, session.workspace.id),
      eq(supportTickets.requesterUserId, session.user.id),
    ];
    if (filters.status)
      conditions.push(eq(supportTickets.status, filters.status));
    if (filters.q) {
      const value = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(supportTickets.subject, value),
          ilike(supportTickets.description, value),
        )!,
      );
    }
    const where = and(...conditions)!;
    const offset = (filters.page - 1) * filters.limit;
    const [rows, totalRows] = await Promise.all([
      this.database.db
        .select({ ticket: supportTickets, category: supportCategories })
        .from(supportTickets)
        .innerJoin(
          supportCategories,
          eq(supportTickets.categoryId, supportCategories.id),
        )
        .where(where)
        .orderBy(desc(supportTickets.lastActivityAt), desc(supportTickets.id))
        .limit(filters.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(supportTickets)
        .where(where),
    ]);
    const commentsByTicket = await this.commentCounts(
      rows.map(({ ticket }) => ticket.id),
    );
    return {
      tickets: rows.map(({ ticket, category }) =>
        this.serializeTicket(
          ticket,
          category,
          commentsByTicket.get(ticket.id) ?? 0,
        ),
      ),
      page: filters.page,
      limit: filters.limit,
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async get(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalSupportTicketDetail> {
    const current = await this.findForRequester(session, id);
    const now = new Date();
    const [comments] = await Promise.all([
      this.commentsFor(current.ticket.id, session.workspace.id),
      this.database.db
        .update(supportTickets)
        .set({ requesterLastReadAt: now, updatedAt: now })
        .where(eq(supportTickets.id, current.ticket.id)),
    ]);
    return {
      ...this.serializeTicket(
        current.ticket,
        current.category,
        comments.length,
      ),
      comments,
    };
  }

  async create(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalSupportTicket> {
    const values = this.parse(createPortalSupportTicketSchema.safeParse(input));
    const category = await this.activeCategory(values.categoryId);
    const now = new Date();
    const [ticket] = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(supportTickets)
        .values({
          workspaceId: session.workspace.id,
          requesterUserId: session.user.id,
          categoryId: category.id,
          subject: values.subject,
          description: values.description,
          requesterLastReadAt: now,
          lastActivityAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw this.failed();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'support_ticket.created',
        subjectType: 'support_ticket',
        subjectId: created.id,
        summary: 'Support ticket created',
        metadata: { categoryId: category.id },
      });
      return [created];
    });
    if (!ticket) throw this.failed();
    return this.serializeTicket(ticket, category, 0);
  }

  async addComment(
    session: PortalAuthSession,
    id: string,
    input: unknown,
  ): Promise<PortalSupportTicketDetail> {
    const values = this.parse(
      createPortalSupportTicketCommentSchema.safeParse(input),
    );
    const current = await this.findForRequester(session, id);
    if (current.ticket.status !== 'open') throw this.notOpen();
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx.insert(supportTicketComments).values({
        supportTicketId: current.ticket.id,
        workspaceId: session.workspace.id,
        authorUserId: session.user.id,
        authorRole: 'requester',
        body: values.body,
        createdAt: now,
        updatedAt: now,
      });
      await tx
        .update(supportTickets)
        .set({
          requesterLastReadAt: now,
          supportLastReadAt: null,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(supportTickets.id, current.ticket.id));
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'support_ticket.comment_created',
        subjectType: 'support_ticket',
        subjectId: current.ticket.id,
        summary: 'Support ticket reply created',
        metadata: {},
      });
    });
    return this.get(session, current.ticket.id);
  }

  async resolve(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalSupportTicket> {
    const current = await this.findForRequester(session, id);
    if (current.ticket.status !== 'open') throw this.notOpen();
    const now = new Date();
    const [ticket] = await this.database.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(supportTickets)
        .set({
          status: 'resolved',
          resolvedAt: now,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(supportTickets.id, current.ticket.id))
        .returning();
      if (!updated) throw this.notFound();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'support_ticket.resolved',
        subjectType: 'support_ticket',
        subjectId: updated.id,
        summary: 'Support ticket resolved by requester',
        metadata: {},
      });
      return [updated];
    });
    if (!ticket) throw this.notFound();
    const count = await this.commentCount(ticket.id);
    return this.serializeTicket(ticket, current.category, count);
  }

  private async findForRequester(session: PortalAuthSession, id: string) {
    if (!this.isUuid(id)) throw this.notFound();
    const [current] = await this.database.db
      .select({ ticket: supportTickets, category: supportCategories })
      .from(supportTickets)
      .innerJoin(
        supportCategories,
        eq(supportTickets.categoryId, supportCategories.id),
      )
      .where(
        and(
          eq(supportTickets.id, id),
          eq(supportTickets.workspaceId, session.workspace.id),
          eq(supportTickets.requesterUserId, session.user.id),
        ),
      )
      .limit(1);
    if (!current) throw this.notFound();
    return current;
  }

  private async activeCategory(id: string) {
    const [category] = await this.database.db
      .select()
      .from(supportCategories)
      .where(
        and(
          eq(supportCategories.id, id),
          eq(supportCategories.status, 'active'),
        ),
      )
      .limit(1);
    if (!category)
      throw new AppException(
        'SUPPORT_CATEGORY_UNAVAILABLE',
        HttpStatus.BAD_REQUEST,
      );
    return category;
  }

  private async commentsFor(ticketId: string, workspaceId: string) {
    const rows = await this.database.db
      .select({ comment: supportTicketComments, author: users })
      .from(supportTicketComments)
      .innerJoin(users, eq(supportTicketComments.authorUserId, users.id))
      .where(
        and(
          eq(supportTicketComments.supportTicketId, ticketId),
          eq(supportTicketComments.workspaceId, workspaceId),
        ),
      )
      .orderBy(
        asc(supportTicketComments.createdAt),
        asc(supportTicketComments.id),
      );
    return rows.map(({ comment, author }): PortalSupportTicketComment => ({
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

  private async commentCount(ticketId: string) {
    const [row] = await this.database.db
      .select({ total: count() })
      .from(supportTicketComments)
      .where(eq(supportTicketComments.supportTicketId, ticketId));
    return Number(row?.total ?? 0);
  }

  private serializeCategory(category: Category): PortalSupportCategory {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
    };
  }

  private serializeTicket(
    ticket: Ticket,
    category: Category,
    commentCount: number,
  ): PortalSupportTicket {
    return {
      id: ticket.id,
      category: this.serializeCategory(category),
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      commentCount,
      updatedAt: ticket.lastActivityAt.toISOString(),
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

  private notOpen() {
    return new AppException('SUPPORT_TICKET_NOT_OPEN', HttpStatus.CONFLICT);
  }

  private failed() {
    return new AppException('REQUEST_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
