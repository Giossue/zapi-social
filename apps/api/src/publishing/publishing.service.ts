import { HttpStatus, Injectable } from '@nestjs/common';
import {
  fileAssets,
  publishingPostMedia,
  publishingPosts,
  socialAccounts,
} from '@workspace/database';
import { and, desc, eq, inArray, isNull } from '@workspace/database/query';
import {
  createPortalPublishingPostsSchema,
  updatePortalPublishingPostSchema,
  type PortalAuthSession,
  type PortalPublishingPost,
  type PortalPublishingResponse,
  type PublishingProvider,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const publishCapabilities = new Set([
  'facebook_page',
  'instagram_profile',
  'whatsapp_status',
]);

type Account = typeof socialAccounts.$inferSelect;
type Post = typeof publishingPosts.$inferSelect;

@Injectable()
export class PublishingService {
  constructor(private readonly database: DatabaseService) {}

  async list(session: PortalAuthSession): Promise<PortalPublishingResponse> {
    const [accounts, posts, media] = await Promise.all([
      this.database.db
        .select()
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.workspaceId, session.workspace.id),
            eq(socialAccounts.status, 'active'),
            isNull(socialAccounts.disconnectedAt),
          ),
        )
        .orderBy(desc(socialAccounts.updatedAt)),
      this.database.db
        .select({ post: publishingPosts, account: socialAccounts })
        .from(publishingPosts)
        .innerJoin(
          socialAccounts,
          eq(publishingPosts.socialAccountId, socialAccounts.id),
        )
        .where(eq(publishingPosts.workspaceId, session.workspace.id))
        .orderBy(
          desc(publishingPosts.scheduledAt),
          desc(publishingPosts.createdAt),
        ),
      this.database.db
        .select()
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.workspaceId, session.workspace.id),
            eq(fileAssets.status, 'ready'),
          ),
        )
        .orderBy(desc(fileAssets.updatedAt)),
    ]);
    const postIds = posts.map(({ post }) => post.id);
    const mediaByPost = new Map<string, string[]>();
    if (postIds.length) {
      const relations = await this.database.db
        .select()
        .from(publishingPostMedia)
        .where(inArray(publishingPostMedia.publishingPostId, postIds));
      for (const relation of relations)
        mediaByPost.set(relation.publishingPostId, [
          ...(mediaByPost.get(relation.publishingPostId) ?? []),
          relation.fileAssetId,
        ]);
    }
    return {
      canView: true,
      canManage: this.canManage(session),
      focusDate: new Date().toISOString().slice(0, 10),
      accounts: accounts
        .filter((account) => publishCapabilities.has(account.capabilityKey))
        .map((account) => this.serializeAccount(account)),
      posts: posts.map(({ post, account }) =>
        this.serializePost(post, account, mediaByPost.get(post.id) ?? []),
      ),
      media: media
        .map((asset) => {
          const kind = this.mediaKind(asset.mimeType);
          return kind
            ? {
                id: asset.id,
                kind,
                name: asset.name,
                thumbnailStatus: asset.thumbnailStatus,
              }
            : null;
        })
        .filter(
          (
            asset,
          ): asset is {
            id: string;
            kind: 'image' | 'video';
            name: string;
            thumbnailStatus: 'pending' | 'ready' | 'failed' | 'not_applicable';
          } => asset !== null,
        ),
    };
  }

  async create(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalPublishingPost[]> {
    this.requireManage(session);
    const parsed = createPortalPublishingPostsSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const accounts = await this.accountsForWorkspace(
      session.workspace.id,
      parsed.data.accountIds,
    );
    const mediaIds = await this.mediaForWorkspace(
      session.workspace.id,
      parsed.data.mediaAssetIds,
    );
    this.validateDestinations(accounts, mediaIds.length);
    const status =
      parsed.data.mode === 'draft'
        ? 'draft'
        : parsed.data.mode === 'schedule'
          ? 'scheduled'
          : 'processing';
    const scheduledAt =
      parsed.data.mode === 'schedule' && parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : null;
    if (scheduledAt && Number.isNaN(scheduledAt.valueOf()))
      throw this.invalid();
    const created = await this.database.db.transaction(async (tx) => {
      const result: Array<{ post: Post; account: Account }> = [];
      for (const account of accounts) {
        const [post] = await tx
          .insert(publishingPosts)
          .values({
            workspaceId: session.workspace.id,
            authorUserId: session.user.id,
            socialAccountId: account.id,
            content: parsed.data.content,
            status,
            scheduledAt,
          })
          .returning();
        if (!post) throw this.failed();
        if (mediaIds.length)
          await tx
            .insert(publishingPostMedia)
            .values(
              mediaIds.map((fileAssetId, position) => ({
                publishingPostId: post.id,
                fileAssetId,
                position,
              })),
            );
        result.push({ post, account });
      }
      return result;
    });
    return created.map(({ post, account }) =>
      this.serializePost(post, account, mediaIds),
    );
  }

  async update(
    session: PortalAuthSession,
    id: string,
    input: unknown,
  ): Promise<PortalPublishingPost> {
    this.requireManage(session);
    const parsed = updatePortalPublishingPostSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const existing = await this.postForWorkspace(session.workspace.id, id);
    if (!['draft', 'scheduled', 'failed'].includes(existing.post.status))
      throw this.invalid();
    const nextMode = parsed.data.mode;
    const status =
      nextMode === undefined
        ? existing.post.status
        : nextMode === 'draft'
          ? 'draft'
          : nextMode === 'schedule'
            ? 'scheduled'
            : 'processing';
    const scheduledAt =
      nextMode === 'schedule'
        ? parsed.data.scheduledAt === undefined
          ? existing.post.scheduledAt
          : parsed.data.scheduledAt
            ? new Date(parsed.data.scheduledAt)
            : null
        : nextMode
          ? null
          : parsed.data.scheduledAt === undefined
            ? existing.post.scheduledAt
            : parsed.data.scheduledAt
              ? new Date(parsed.data.scheduledAt)
              : null;
    if (status === 'scheduled' && !scheduledAt) throw this.invalid();
    if (scheduledAt && Number.isNaN(scheduledAt.valueOf()))
      throw this.invalid();
    const mediaIds =
      parsed.data.mediaAssetIds === undefined
        ? null
        : await this.mediaForWorkspace(
            session.workspace.id,
            parsed.data.mediaAssetIds,
          );
    this.validateDestinations([existing.account], mediaIds?.length ?? -1);
    const [post] = await this.database.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(publishingPosts)
        .set({
          content: parsed.data.content ?? existing.post.content,
          status,
          scheduledAt,
          updatedAt: new Date(),
        })
        .where(eq(publishingPosts.id, existing.post.id))
        .returning();
      if (!updated) throw this.notFound();
      if (mediaIds) {
        await tx
          .delete(publishingPostMedia)
          .where(eq(publishingPostMedia.publishingPostId, updated.id));
        if (mediaIds.length)
          await tx
            .insert(publishingPostMedia)
            .values(
              mediaIds.map((fileAssetId, position) => ({
                publishingPostId: updated.id,
                fileAssetId,
                position,
              })),
            );
      }
      return [updated];
    });
    if (!post) throw this.notFound();
    return this.serializePost(
      post,
      existing.account,
      mediaIds ?? (await this.postMediaIds(post.id)),
    );
  }

  async remove(session: PortalAuthSession, id: string) {
    this.requireManage(session);
    const existing = await this.postForWorkspace(session.workspace.id, id);
    if (existing.post.status !== 'draft') throw this.invalid();
    await this.database.db
      .delete(publishingPosts)
      .where(eq(publishingPosts.id, existing.post.id));
  }

  async retry(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalPublishingPost> {
    this.requireManage(session);
    const existing = await this.postForWorkspace(session.workspace.id, id);
    if (existing.post.status !== 'failed') throw this.invalid();
    const [post] = await this.database.db
      .update(publishingPosts)
      .set({ status: 'processing', scheduledAt: null, updatedAt: new Date() })
      .where(eq(publishingPosts.id, existing.post.id))
      .returning();
    if (!post) throw this.notFound();
    return this.serializePost(
      post,
      existing.account,
      await this.postMediaIds(post.id),
    );
  }

  private async accountsForWorkspace(workspaceId: string, ids: string[]) {
    const accounts = await this.database.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, workspaceId),
          eq(socialAccounts.status, 'active'),
          isNull(socialAccounts.disconnectedAt),
          inArray(socialAccounts.id, ids),
        ),
      );
    if (
      accounts.length !== new Set(ids).size ||
      accounts.some(
        (account) => !publishCapabilities.has(account.capabilityKey),
      )
    )
      throw this.notFound();
    return accounts;
  }

  private async mediaForWorkspace(workspaceId: string, ids: string[]) {
    if (!ids.length) return [];
    const assets = await this.database.db
      .select()
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.workspaceId, workspaceId),
          eq(fileAssets.status, 'ready'),
          inArray(fileAssets.id, ids),
        ),
      );
    if (
      assets.length !== new Set(ids).size ||
      assets.some(
        (asset) => !['image', 'video'].includes(this.fileKind(asset.mimeType)),
      )
    )
      throw this.notFound();
    return ids;
  }

  private validateDestinations(accounts: Account[], mediaCount: number) {
    if (mediaCount < 0) return;
    if (
      accounts.some((account) => this.provider(account) !== 'facebook') &&
      mediaCount === 0
    )
      throw this.invalid();
  }

  private async postForWorkspace(workspaceId: string, id: string) {
    const [row] = await this.database.db
      .select({ post: publishingPosts, account: socialAccounts })
      .from(publishingPosts)
      .innerJoin(
        socialAccounts,
        eq(publishingPosts.socialAccountId, socialAccounts.id),
      )
      .where(
        and(
          eq(publishingPosts.id, id),
          eq(publishingPosts.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!row) throw this.notFound();
    return row;
  }

  private async postMediaIds(postId: string) {
    const rows = await this.database.db
      .select({ id: publishingPostMedia.fileAssetId })
      .from(publishingPostMedia)
      .where(eq(publishingPostMedia.publishingPostId, postId));
    return rows.map((row) => row.id);
  }

  private serializeAccount(account: Account) {
    const provider = this.provider(account);
    return {
      id: account.id,
      name: account.displayName,
      assignedName: account.handle ?? null,
      provider,
      detail:
        provider === 'facebook'
          ? 'Página de Facebook'
          : provider === 'instagram'
            ? 'Perfil de Instagram'
            : 'Estado de WhatsApp',
      connected: account.status === 'active' && !account.disconnectedAt,
    };
  }

  private serializePost(
    post: Post,
    account: Account,
    mediaAssetIds: string[],
  ): PortalPublishingPost {
    const when = post.scheduledAt ?? post.createdAt;
    const date = when.toISOString().slice(0, 10);
    const provider = this.provider(account);
    const content = post.content.trim();
    return {
      id: post.id,
      socialAccountId: account.id,
      date,
      time:
        post.status === 'processing' && !post.scheduledAt
          ? 'Ahora'
          : when.toISOString().slice(11, 16),
      title:
        content.length > 54
          ? `${content.slice(0, 51)}…`
          : content || 'Publicación sin texto',
      content: post.content,
      channel: `${account.displayName} · ${provider === 'facebook' ? 'Facebook' : provider === 'instagram' ? 'Instagram' : 'WhatsApp'}`,
      provider,
      status: post.status,
      hasMedia: mediaAssetIds.length > 0,
      recoverable: post.status === 'failed',
      mediaAssetIds,
    };
  }

  private provider(account: Account): PublishingProvider {
    if (account.capabilityKey === 'instagram_profile') return 'instagram';
    if (account.capabilityKey === 'whatsapp_status') return 'whatsapp';
    return 'facebook';
  }
  private mediaKind(mimeType: string): 'image' | 'video' | null {
    return mimeType.startsWith('image/')
      ? 'image'
      : mimeType.startsWith('video/')
        ? 'video'
        : null;
  }
  private fileKind(mimeType: string) {
    return mimeType.startsWith('image/')
      ? 'image'
      : mimeType.startsWith('video/')
        ? 'video'
        : 'document';
  }
  private canManage(session: PortalAuthSession) {
    return (
      session.workspace.role === 'owner' || session.workspace.role === 'admin'
    );
  }
  private requireManage(session: PortalAuthSession) {
    if (!this.canManage(session))
      throw new AppException(
        'AUTH_PORTAL_ACCESS_REQUIRED',
        HttpStatus.FORBIDDEN,
      );
  }
  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }
  private notFound() {
    return new AppException('REQUEST_FAILED', HttpStatus.NOT_FOUND);
  }
  private failed() {
    return new AppException('REQUEST_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
