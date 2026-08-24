import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { fileAssets, linkBioEvents, linkBioPages } from '@workspace/database';
import { and, desc, eq, inArray, sql } from '@workspace/database/query';
import {
  trackPublicLinkBioEventSchema,
  upsertPortalLinkBioPageSchema,
  workspacePermissionMatches,
  type PortalAuthSession,
  type PortalLinkBioPage,
  type PortalLinkBioPagesResponse,
  type PublicLinkBioPage,
} from '@workspace/contracts';
import { AppException } from '../platform/errors/app-exception';
import { DatabaseService } from '../database/database.service';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

@Injectable()
export class LinkBioService {
  constructor(private readonly database: DatabaseService) {}

  async list(session: PortalAuthSession): Promise<PortalLinkBioPagesResponse> {
    const pages = await this.database.db
      .select()
      .from(linkBioPages)
      .where(eq(linkBioPages.workspaceId, session.workspace.id))
      .orderBy(desc(linkBioPages.updatedAt));

    const counts = pages.length
      ? await this.database.db
          .select({
            pageId: linkBioEvents.pageId,
            type: linkBioEvents.type,
            total: sql<number>`count(*)::int`,
          })
          .from(linkBioEvents)
          .where(
            inArray(
              linkBioEvents.pageId,
              pages.map((page) => page.id),
            ),
          )
          .groupBy(linkBioEvents.pageId, linkBioEvents.type)
      : [];

    const rows = pages.map((page) => {
      const views =
        counts.find((row) => row.pageId === page.id && row.type === 'view')
          ?.total ?? 0;
      const clicks =
        counts.find((row) => row.pageId === page.id && row.type === 'click')
          ?.total ?? 0;
      return this.toPortal(page, views, clicks);
    });

    return {
      canManage:
        ['owner', 'admin'].includes(session.workspace.role) ||
        workspacePermissionMatches(
          session.workspace.permissions,
          'link-bio.manage',
        ),
      pages: rows,
      metrics: {
        total: rows.length,
        published: rows.filter((page) => page.status === 'published').length,
        views: rows.reduce((total, page) => total + page.views, 0),
        clicks: rows.reduce((total, page) => total + page.clicks, 0),
      },
    };
  }

  async save(
    session: PortalAuthSession,
    id: string | null,
    input: unknown,
  ): Promise<PortalLinkBioPage> {
    this.requireManager(session);
    const parsed = upsertPortalLinkBioPageSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const values = parsed.data;
    const slug = values.slug ?? slugify(values.title);
    if (!slug || slug.length < 3) throw this.invalid();

    await this.assertOwnedAssets(session, [
      values.avatarFileAssetId,
      values.coverFileAssetId,
    ]);

    const publishedAt = values.status === 'published' ? new Date() : null;

    try {
      if (id) {
        const [existing] = await this.database.db
          .select({ publishedAt: linkBioPages.publishedAt })
          .from(linkBioPages)
          .where(
            and(
              eq(linkBioPages.id, id),
              eq(linkBioPages.workspaceId, session.workspace.id),
            ),
          )
          .limit(1);
        if (!existing) throw this.notFound();

        const [row] = await this.database.db
          .update(linkBioPages)
          .set({
            ...values,
            slug,
            publishedAt:
              values.status === 'published'
                ? (existing.publishedAt ?? new Date())
                : null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(linkBioPages.id, id),
              eq(linkBioPages.workspaceId, session.workspace.id),
            ),
          )
          .returning();
        return this.toPortal(row, 0, 0);
      }

      const [row] = await this.database.db
        .insert(linkBioPages)
        .values({
          ...values,
          createdByUserId: session.user.id,
          publishedAt,
          slug,
          workspaceId: session.workspace.id,
        })
        .returning();
      return this.toPortal(row, 0, 0);
    } catch (error) {
      const code =
        error && typeof error === 'object'
          ? (error as { code?: unknown }).code
          : undefined;
      if (code === '23505') {
        throw new AppException('LINK_BIO_SLUG_TAKEN', HttpStatus.CONFLICT);
      }
      throw error instanceof AppException ? error : this.invalid();
    }
  }

  async remove(session: PortalAuthSession, id: string) {
    this.requireManager(session);
    const rows = await this.database.db
      .delete(linkBioPages)
      .where(
        and(
          eq(linkBioPages.id, id),
          eq(linkBioPages.workspaceId, session.workspace.id),
        ),
      )
      .returning({ id: linkBioPages.id });
    if (!rows.length) throw this.notFound();
  }

  async publicPage(slug: string): Promise<PublicLinkBioPage> {
    const [page] = await this.database.db
      .select()
      .from(linkBioPages)
      .where(
        and(eq(linkBioPages.slug, slug), eq(linkBioPages.status, 'published')),
      )
      .limit(1);
    if (!page) throw this.notFound();

    return {
      appearance: page.appearance as PublicLinkBioPage['appearance'],
      avatarUrl: page.avatarFileAssetId
        ? `/v1/portal/files/${page.avatarFileAssetId}/preview`
        : null,
      blocks: (page.blocks as PublicLinkBioPage['blocks']).filter(
        (block) => block.enabled,
      ),
      coverUrl: page.coverFileAssetId
        ? `/v1/portal/files/${page.coverFileAssetId}/preview`
        : null,
      description: page.description,
      headline: page.headline,
      slug: page.slug,
      templateKey: page.templateKey as PublicLinkBioPage['templateKey'],
      title: page.title,
    };
  }

  async track(
    slug: string,
    input: unknown,
    ip: string | null,
    agent: string | null,
  ) {
    const parsed = trackPublicLinkBioEventSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();

    const [page] = await this.database.db
      .select({ id: linkBioPages.id, blocks: linkBioPages.blocks })
      .from(linkBioPages)
      .where(
        and(eq(linkBioPages.slug, slug), eq(linkBioPages.status, 'published')),
      )
      .limit(1);
    if (!page) throw this.notFound();

    const { blockIndex, itemIndex, type } = parsed.data;
    const blocks = page.blocks as { items?: { url?: string }[] }[];
    const url =
      type === 'click' && blockIndex !== undefined && itemIndex !== undefined
        ? (blocks[blockIndex]?.items?.[itemIndex]?.url ?? null)
        : null;

    await this.database.db.insert(linkBioEvents).values({
      blockIndex: blockIndex ?? null,
      ipHash: ip ? createHash('sha256').update(ip).digest('hex') : null,
      itemIndex: itemIndex ?? null,
      pageId: page.id,
      type,
      url,
      userAgent: agent ? agent.slice(0, 255) : null,
    });

    return { url };
  }

  private async assertOwnedAssets(
    session: PortalAuthSession,
    ids: (string | null)[],
  ) {
    const wanted = ids.filter((id): id is string => Boolean(id));
    if (!wanted.length) return;
    const rows = await this.database.db
      .select({ id: fileAssets.id })
      .from(fileAssets)
      .where(
        and(
          inArray(fileAssets.id, wanted),
          eq(fileAssets.workspaceId, session.workspace.id),
        ),
      );
    if (rows.length !== new Set(wanted).size) throw this.invalid();
  }

  private toPortal(
    page: typeof linkBioPages.$inferSelect,
    views: number,
    clicks: number,
  ): PortalLinkBioPage {
    return {
      appearance: page.appearance as PortalLinkBioPage['appearance'],
      avatarFileAssetId: page.avatarFileAssetId,
      blocks: page.blocks as PortalLinkBioPage['blocks'],
      clicks,
      coverFileAssetId: page.coverFileAssetId,
      createdAt: page.createdAt.toISOString(),
      description: page.description,
      headline: page.headline,
      id: page.id,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      slug: page.slug,
      status: page.status,
      templateKey: page.templateKey as PortalLinkBioPage['templateKey'],
      title: page.title,
      updatedAt: page.updatedAt.toISOString(),
      views,
    };
  }

  private requireManager(session: PortalAuthSession) {
    if (
      !['owner', 'admin'].includes(session.workspace.role) &&
      !workspacePermissionMatches(
        session.workspace.permissions,
        'link-bio.manage',
      )
    ) {
      throw new AppException('LINK_BIO_FORBIDDEN', HttpStatus.FORBIDDEN);
    }
  }

  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private notFound() {
    return new AppException('LINK_BIO_PAGE_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}
