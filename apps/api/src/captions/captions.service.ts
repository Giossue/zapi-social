import { HttpStatus, Injectable } from '@nestjs/common'
import { auditLogs, captions } from '@workspace/database'
import { and, desc, eq, ilike, or } from '@workspace/database/query'
import {
  createPortalCaptionSchema,
  portalCaptionsQuerySchema,
  updatePortalCaptionSchema,
  type PortalAuthSession,
  type PortalCaption,
  type PortalCaptionsResponse,
} from '@workspace/contracts'
import { DatabaseService } from '../database/database.service'
import { AppException } from '../platform/errors/app-exception'

@Injectable()
export class CaptionsService {
  constructor(private readonly database: DatabaseService) {}

  async list(session: PortalAuthSession, query: unknown): Promise<PortalCaptionsResponse> {
    const parsed = portalCaptionsQuerySchema.safeParse(query)
    if (!parsed.success) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST)

    const filters = [eq(captions.workspaceId, session.workspace.id)]
    if (parsed.data.sourceType) filters.push(eq(captions.sourceType, parsed.data.sourceType))
    if (parsed.data.status) filters.push(eq(captions.status, parsed.data.status))
    if (parsed.data.q) {
      const value = `%${parsed.data.q}%`
      filters.push(or(ilike(captions.name, value), ilike(captions.content, value), ilike(captions.notes, value))!)
    }

    const [rows, metricRows] = await Promise.all([
      this.database.db.select().from(captions).where(and(...filters)).orderBy(desc(captions.updatedAt), desc(captions.id)),
      this.database.db.select().from(captions).where(eq(captions.workspaceId, session.workspace.id)),
    ])

    return {
      captions: rows.map((caption) => this.toCaption(caption)),
      metrics: {
        total: metricRows.length,
        ai: metricRows.filter((caption) => caption.sourceType === 'ai').length,
        manual: metricRows.filter((caption) => caption.sourceType === 'manual').length,
        active: metricRows.filter((caption) => caption.status === 'active').length,
      },
    }
  }

  async create(session: PortalAuthSession, input: unknown): Promise<PortalCaption> {
    const parsed = createPortalCaptionSchema.safeParse(input)
    if (!parsed.success) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST)

    const now = new Date()
    const slug = await this.uniqueSlug(session.workspace.id, parsed.data.name)
    const [caption] = await this.database.db.transaction(async (tx) => {
      const [created] = await tx.insert(captions).values({
        workspaceId: session.workspace.id,
        createdByUserId: session.user.id,
        name: parsed.data.name,
        slug,
        sourceType: parsed.data.sourceType,
        status: parsed.data.status,
        content: parsed.data.content,
        notes: parsed.data.notes,
        tags: parsed.data.tags,
        createdAt: now,
        updatedAt: now,
      }).returning()
      if (!created) throw new AppException('CAPTION_CREATE_FAILED', HttpStatus.INTERNAL_SERVER_ERROR)
      await tx.insert(auditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'caption.created',
        subjectType: 'caption',
        subjectId: created.id,
        metadata: {},
      })
      return [created]
    })

    if (!caption) throw new AppException('CAPTION_CREATE_FAILED', HttpStatus.INTERNAL_SERVER_ERROR)
    return this.toCaption(caption)
  }

  async update(session: PortalAuthSession, id: string, input: unknown): Promise<PortalCaption> {
    const captionId = this.parseId(id)
    const parsed = updatePortalCaptionSchema.safeParse(input)
    if (!parsed.success) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST)

    const existing = await this.findForWorkspace(session.workspace.id, captionId)
    const slug = parsed.data.name === undefined ? existing.slug : await this.uniqueSlug(session.workspace.id, parsed.data.name, captionId)
    const [caption] = await this.database.db.transaction(async (tx) => {
      const [updated] = await tx.update(captions)
        .set({ ...parsed.data, slug, updatedAt: new Date() })
        .where(and(eq(captions.id, captionId), eq(captions.workspaceId, session.workspace.id)))
        .returning()
      if (!updated) throw this.notFound()
      await tx.insert(auditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'caption.updated',
        subjectType: 'caption',
        subjectId: updated.id,
        metadata: { changedFields: Object.keys(parsed.data) },
      })
      return [updated]
    })

    if (!caption) throw this.notFound()
    return this.toCaption(caption)
  }

  async remove(session: PortalAuthSession, id: string): Promise<void> {
    const captionId = this.parseId(id)
    await this.database.db.transaction(async (tx) => {
      const [removed] = await tx.delete(captions)
        .where(and(eq(captions.id, captionId), eq(captions.workspaceId, session.workspace.id)))
        .returning({ id: captions.id })
      if (!removed) throw this.notFound()
      await tx.insert(auditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'caption.deleted',
        subjectType: 'caption',
        subjectId: removed.id,
        metadata: {},
      })
    })
  }

  private async findForWorkspace(workspaceId: string, id: string) {
    const [caption] = await this.database.db.select().from(captions)
      .where(and(eq(captions.id, id), eq(captions.workspaceId, workspaceId))).limit(1)
    if (!caption) throw this.notFound()
    return caption
  }

  private async uniqueSlug(workspaceId: string, name: string, ignoreId?: string) {
    const base = this.slugify(name) || 'caption'
    let slug = base
    let suffix = 2
    while (true) {
      const [existing] = await this.database.db.select({ id: captions.id }).from(captions)
        .where(and(eq(captions.workspaceId, workspaceId), eq(captions.slug, slug))).limit(1)
      if (!existing || existing.id === ignoreId) return slug
      slug = `${base}-${suffix++}`.slice(0, 140)
    }
  }

  private slugify(value: string) {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140)
  }

  private parseId(value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw this.notFound()
    return value
  }

  private notFound() {
    return new AppException('CAPTION_NOT_FOUND', HttpStatus.NOT_FOUND)
  }

  private toCaption(caption: typeof captions.$inferSelect): PortalCaption {
    return {
      id: caption.id,
      name: caption.name,
      sourceType: caption.sourceType,
      status: caption.status,
      content: caption.content,
      notes: caption.notes,
      tags: caption.tags,
      updatedAt: caption.updatedAt.toISOString(),
    }
  }
}
