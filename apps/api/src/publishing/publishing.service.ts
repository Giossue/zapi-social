import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import {
  apiAuditLogs,
  fileAssets,
  publishingPostMedia,
  publishingPosts,
  socialAccounts,
} from '@workspace/database';
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from '@workspace/database/query';
import {
  createPortalPublishingPostsSchema,
  portalPublishingQuerySchema,
  updatePortalPublishingPostSchema,
  type PortalAuthSession,
  type PortalPublishingPost,
  type PortalPublishingResponse,
  type PublishingProvider,
} from '@workspace/contracts';
import { publishVariantStorageKey } from '@workspace/file-ingestion';
import { DatabaseService } from '../database/database.service';
import { AutomationEventsService } from '../automation/automation-events.service';
import { AppException } from '../platform/errors/app-exception';
import { TeamAccountAccessService } from '../teams/team-account-access.service';
import {
  PUBLISHING_DELIVERY_JOB,
  PUBLISHING_DELIVERY_QUEUE,
  type PublishingDeliveryJobData,
} from './publishing.constants';

const publishCapabilities = new Set([
  'facebook_page',
  'instagram_profile',
  'whatsapp_status',
]);

type Account = typeof socialAccounts.$inferSelect;
type Post = typeof publishingPosts.$inferSelect;

@Injectable()
export class PublishingService {
  private readonly mediaSigningKey: string;
  private readonly storageRoot: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly accountAccess: TeamAccountAccessService,
    private readonly events: AutomationEventsService,
    @InjectQueue(PUBLISHING_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<PublishingDeliveryJobData>,
    config: ConfigService,
  ) {
    this.mediaSigningKey = config.getOrThrow<string>(
      'PROVIDER_INTEGRATIONS_ENCRYPTION_KEY',
    );
    this.storageRoot = resolve(config.getOrThrow<string>('FILES_STORAGE_PATH'));
  }

  async publicMedia(
    assetId: string,
    expiresValue: unknown,
    signature: unknown,
    variantValue?: unknown,
  ) {
    const expires = Number(expiresValue);
    const variant =
      typeof variantValue === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        variantValue,
      )
        ? variantValue
        : null;
    if (
      !Number.isInteger(expires) ||
      expires <= Math.floor(Date.now() / 1000) ||
      expires > Math.floor(Date.now() / 1000) + 20 * 60 ||
      typeof signature !== 'string' ||
      (variantValue !== undefined && !variant)
    ) {
      throw this.notFound();
    }
    const expected = createHmac('sha256', this.mediaSigningKey)
      .update(`${assetId}.${variant ?? ''}.${expires}`)
      .digest('hex');
    const supplied = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (
      supplied.length !== expectedBuffer.length ||
      !timingSafeEqual(supplied, expectedBuffer)
    ) {
      throw this.notFound();
    }
    const [asset] = await this.database.db
      .select()
      .from(fileAssets)
      .where(and(eq(fileAssets.id, assetId), eq(fileAssets.status, 'ready')))
      .limit(1);
    if (!asset) throw this.notFound();
    if (variant) {
      const [relation] = await this.database.db
        .select({ id: publishingPostMedia.id })
        .from(publishingPostMedia)
        .innerJoin(
          publishingPosts,
          eq(publishingPostMedia.publishingPostId, publishingPosts.id),
        )
        .where(
          and(
            eq(publishingPosts.id, variant),
            eq(publishingPosts.workspaceId, asset.workspaceId),
            eq(publishingPosts.status, 'processing'),
            eq(publishingPostMedia.fileAssetId, asset.id),
          ),
        )
        .limit(1);
      if (!relation) throw this.notFound();
    }
    const storageKey = variant
      ? publishVariantStorageKey({
          workspaceId: asset.workspaceId,
          assetId: asset.id,
          postId: variant,
          extension: asset.storageKey,
        })
      : asset.storageKey;
    const path = resolve(this.storageRoot, storageKey);
    if (!path.startsWith(`${this.storageRoot}/`)) throw this.notFound();
    const information = await stat(path).catch(() => null);
    if (!information?.isFile()) throw this.notFound();
    return {
      mimeType:
        variant &&
        asset.mimeType.startsWith('video/') &&
        asset.mimeType !== 'video/webm'
          ? 'video/mp4'
          : asset.mimeType,
      name: asset.name,
      size: information.size,
      stream: createReadStream(path),
    };
  }

  async list(
    session: PortalAuthSession,
    query: unknown = {},
  ): Promise<PortalPublishingResponse> {
    const parsed = portalPublishingQuerySchema.safeParse(query);
    if (!parsed.success) throw this.invalid();
    const now = new Date();
    const rangeFrom = parsed.data.from
      ? new Date(parsed.data.from)
      : new Date(now.getTime() - 366 * 24 * 60 * 60 * 1_000);
    const rangeTo = parsed.data.to
      ? new Date(parsed.data.to)
      : new Date(now.getTime() + 366 * 24 * 60 * 60 * 1_000);
    const offset = (parsed.data.page - 1) * parsed.data.limit;
    const accountScope = await this.accountAccess.resolve(session);
    const grantedAccountIds = [...accountScope.accountIds];
    const hasNoGrantedAccounts =
      !accountScope.unrestricted && grantedAccountIds.length === 0;
    const postWhere = and(
      eq(publishingPosts.workspaceId, session.workspace.id),
      sql`coalesce(${publishingPosts.scheduledAt}, ${publishingPosts.createdAt}) >= ${rangeFrom.toISOString()}::timestamptz`,
      sql`coalesce(${publishingPosts.scheduledAt}, ${publishingPosts.createdAt}) <= ${rangeTo.toISOString()}::timestamptz`,
      ...(!accountScope.unrestricted
        ? [inArray(socialAccounts.id, grantedAccountIds)]
        : []),
    )!;
    const accountsPromise = hasNoGrantedAccounts
      ? Promise.resolve([] as Account[])
      : this.database.db
          .select()
          .from(socialAccounts)
          .where(
            and(
              eq(socialAccounts.workspaceId, session.workspace.id),
              eq(socialAccounts.status, 'active'),
              isNull(socialAccounts.disconnectedAt),
              ...(!accountScope.unrestricted
                ? [inArray(socialAccounts.id, grantedAccountIds)]
                : []),
            ),
          )
          .orderBy(desc(socialAccounts.updatedAt));
    const postsPromise = hasNoGrantedAccounts
      ? Promise.resolve([] as Array<{ post: Post; account: Account }>)
      : this.database.db
          .select({ post: publishingPosts, account: socialAccounts })
          .from(publishingPosts)
          .innerJoin(
            socialAccounts,
            eq(publishingPosts.socialAccountId, socialAccounts.id),
          )
          .where(postWhere)
          .orderBy(
            desc(publishingPosts.scheduledAt),
            desc(publishingPosts.createdAt),
          )
          .limit(parsed.data.limit)
          .offset(offset);
    const postsTotalPromise = hasNoGrantedAccounts
      ? Promise.resolve([{ total: 0 }])
      : this.database.db
          .select({ total: count() })
          .from(publishingPosts)
          .innerJoin(
            socialAccounts,
            eq(publishingPosts.socialAccountId, socialAccounts.id),
          )
          .where(postWhere);
    const mediaWhere = and(
      eq(fileAssets.workspaceId, session.workspace.id),
      eq(fileAssets.status, 'ready'),
      sql`(${fileAssets.mimeType} like 'image/%' or ${fileAssets.mimeType} like 'video/%')`,
    )!;
    const [accounts, posts, postsTotal, media, mediaTotal] = await Promise.all([
      accountsPromise,
      postsPromise,
      postsTotalPromise,
      this.database.db
        .select()
        .from(fileAssets)
        .where(mediaWhere)
        .orderBy(desc(fileAssets.updatedAt))
        .limit(parsed.data.mediaLimit),
      this.database.db
        .select({ total: count() })
        .from(fileAssets)
        .where(mediaWhere),
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
      page: parsed.data.page,
      limit: parsed.data.limit,
      total: Number(postsTotal[0]?.total ?? 0),
      mediaLimit: parsed.data.mediaLimit,
      mediaTotal: Number(mediaTotal[0]?.total ?? 0),
      range: {
        from: rangeFrom.toISOString(),
        to: rangeTo.toISOString(),
      },
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
      session,
      parsed.data.accountIds,
    );
    const accountById = new Map(
      accounts.map((account) => [account.id, account]),
    );
    const orderedAccounts = parsed.data.accountIds.map((id) => {
      const account = accountById.get(id);
      if (!account) throw this.notFound();
      return account;
    });
    const mediaIds = await this.mediaForWorkspace(
      session.workspace.id,
      parsed.data.mediaAssetIds,
    );
    this.validateDestinations(orderedAccounts, mediaIds.length);
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
    let created = await this.portalOperation(
      session.workspace.id,
      parsed.data.idempotencyKey,
      orderedAccounts,
    );
    if (!created.length) {
      try {
        created = await this.database.db.transaction(async (tx) => {
          const result: Array<{ post: Post; account: Account }> = [];
          for (const account of orderedAccounts) {
            const [post] = await tx
              .insert(publishingPosts)
              .values({
                workspaceId: session.workspace.id,
                authorUserId: session.user.id,
                socialAccountId: account.id,
                content: parsed.data.content,
                status,
                scheduledAt,
                source: 'portal',
                externalReference: parsed.data.idempotencyKey,
              })
              .returning();
            if (!post) throw this.failed();
            if (mediaIds.length)
              await tx.insert(publishingPostMedia).values(
                mediaIds.map((fileAssetId, position) => ({
                  publishingPostId: post.id,
                  fileAssetId,
                  position,
                  workspaceId: session.workspace.id,
                })),
              );
            await this.events.emitInTransaction(tx, {
              workspaceId: session.workspace.id,
              event: 'post.created',
              subjectId: post.id,
              payload: { postId: post.id, status: post.status },
            });
            result.push({ post, account });
          }
          await tx.insert(apiAuditLogs).values(
            result.map(({ post }) => ({
              workspaceId: session.workspace.id,
              actorUserId: session.user.id,
              event: 'publishing.post_created',
              subjectType: 'publishing_post',
              subjectId: post.id,
              metadata: {
                status: post.status,
                mediaCount: mediaIds.length,
                idempotencyKey: parsed.data.idempotencyKey,
              },
            })),
          );
          return result;
        });
      } catch (error) {
        if (!this.isUniqueViolation(error)) throw error;
        created = await this.portalOperation(
          session.workspace.id,
          parsed.data.idempotencyKey,
          orderedAccounts,
        );
        if (!created.length) throw error;
      }
    }
    await Promise.all(
      created
        .filter(({ post }) => post.status === 'processing')
        .map(({ post }) =>
          this.enqueue(post.id, session.workspace.id, post.updatedAt).catch(
            () => undefined,
          ),
        ),
    );
    const mediaByPost = await this.mediaByPostIds(
      created.map(({ post }) => post.id),
    );
    return created.map(({ post, account }) =>
      this.serializePost(post, account, mediaByPost.get(post.id) ?? []),
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
    const existing = await this.postForWorkspace(session, id);
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
          await tx.insert(publishingPostMedia).values(
            mediaIds.map((fileAssetId, position) => ({
              publishingPostId: updated.id,
              fileAssetId,
              position,
              workspaceId: session.workspace.id,
            })),
          );
      }
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'publishing.post_updated',
        subjectType: 'publishing_post',
        subjectId: updated.id,
        metadata: { changedFields: Object.keys(parsed.data) },
      });
      return [updated];
    });
    if (!post) throw this.notFound();
    if (post.status === 'processing') {
      await this.enqueue(post.id, session.workspace.id, post.updatedAt).catch(
        () => undefined,
      );
    }
    return this.serializePost(
      post,
      existing.account,
      mediaIds ?? (await this.postMediaIds(post.id)),
    );
  }

  async remove(session: PortalAuthSession, id: string) {
    this.requireManage(session);
    const existing = await this.postForWorkspace(session, id);
    if (existing.post.status !== 'draft') throw this.invalid();
    await this.database.db.transaction(async (tx) => {
      await tx
        .delete(publishingPosts)
        .where(eq(publishingPosts.id, existing.post.id));
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'publishing.post_deleted',
        subjectType: 'publishing_post',
        subjectId: existing.post.id,
        metadata: {},
      });
    });
  }

  async retry(
    session: PortalAuthSession,
    id: string,
  ): Promise<PortalPublishingPost> {
    this.requireManage(session);
    const existing = await this.postForWorkspace(session, id);
    if (existing.post.status !== 'failed') throw this.invalid();
    if (existing.post.failureCode === 'PUBLISHING_PROVIDER_OUTCOME_UNKNOWN') {
      throw new AppException(
        'PUBLISHING_RETRY_OUTCOME_UNKNOWN',
        HttpStatus.CONFLICT,
      );
    }
    const [post] = await this.database.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(publishingPosts)
        .set({ status: 'processing', scheduledAt: null, updatedAt: new Date() })
        .where(eq(publishingPosts.id, existing.post.id))
        .returning();
      if (!updated) return [];
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'publishing.post_retried',
        subjectType: 'publishing_post',
        subjectId: updated.id,
        metadata: { previousFailureCode: existing.post.failureCode },
      });
      return [updated];
    });
    if (!post) throw this.notFound();
    await this.enqueue(post.id, session.workspace.id, post.updatedAt).catch(
      () => undefined,
    );
    return this.serializePost(
      post,
      existing.account,
      await this.postMediaIds(post.id),
    );
  }

  private async portalOperation(
    workspaceId: string,
    idempotencyKey: string,
    accounts: Account[],
  ): Promise<Array<{ post: Post; account: Account }>> {
    const posts = await this.database.db
      .select()
      .from(publishingPosts)
      .where(
        and(
          eq(publishingPosts.workspaceId, workspaceId),
          eq(publishingPosts.source, 'portal'),
          eq(publishingPosts.externalReference, idempotencyKey),
        ),
      );
    if (!posts.length) return [];
    const postByAccountId = new Map(
      posts.map((post) => [post.socialAccountId, post]),
    );
    if (
      posts.length !== accounts.length ||
      accounts.some((account) => !postByAccountId.has(account.id))
    ) {
      throw new AppException(
        'PUBLISHING_IDEMPOTENCY_CONFLICT',
        HttpStatus.CONFLICT,
      );
    }
    return accounts.map((account) => {
      const post = postByAccountId.get(account.id);
      if (!post) throw this.failed();
      return { post, account };
    });
  }

  private async accountsForWorkspace(
    session: PortalAuthSession,
    ids: string[],
  ) {
    const accountScope = await this.accountAccess.resolve(session);
    if (!this.accountAccess.allowsAll(accountScope, ids)) {
      throw this.notFound();
    }
    const accounts = await this.database.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, session.workspace.id),
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

  private async postForWorkspace(session: PortalAuthSession, id: string) {
    const accountScope = await this.accountAccess.resolve(session);
    const grantedAccountIds = [...accountScope.accountIds];
    if (!accountScope.unrestricted && grantedAccountIds.length === 0) {
      throw this.notFound();
    }
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
          eq(publishingPosts.workspaceId, session.workspace.id),
          ...(!accountScope.unrestricted
            ? [inArray(socialAccounts.id, grantedAccountIds)]
            : []),
        ),
      )
      .limit(1);
    if (!row) throw this.notFound();
    return row;
  }

  private async postMediaIds(postId: string) {
    return (await this.mediaByPostIds([postId])).get(postId) ?? [];
  }

  private async mediaByPostIds(postIds: string[]) {
    const result = new Map<string, string[]>();
    if (!postIds.length) return result;
    const relations = await this.database.db
      .select({
        postId: publishingPostMedia.publishingPostId,
        assetId: publishingPostMedia.fileAssetId,
      })
      .from(publishingPostMedia)
      .where(inArray(publishingPostMedia.publishingPostId, postIds))
      .orderBy(publishingPostMedia.position);
    for (const relation of relations) {
      result.set(relation.postId, [
        ...(result.get(relation.postId) ?? []),
        relation.assetId,
      ]);
    }
    return result;
  }

  private async enqueue(
    publishingPostId: string,
    workspaceId: string,
    version: Date,
  ) {
    await this.deliveryQueue.add(
      PUBLISHING_DELIVERY_JOB,
      { publishingPostId, workspaceId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        jobId: `publishing-${publishingPostId}-${version.getTime()}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
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
      // `now` marca la publicación inmediata: la interfaz decide cómo leerlo.
      time:
        post.status === 'processing' && !post.scheduledAt
          ? 'now'
          : when.toISOString().slice(11, 16),
      // Sin texto, el título queda vacío y la interfaz pone su propio rótulo.
      title:
        content.length > 54 ? `${content.slice(0, 51)}…` : content,
      content: post.content,
      channel: `${account.displayName} · ${provider === 'facebook' ? 'Facebook' : provider === 'instagram' ? 'Instagram' : 'WhatsApp'}`,
      provider,
      status: post.status,
      hasMedia: mediaAssetIds.length > 0,
      recoverable:
        post.status === 'failed' &&
        post.failureCode !== 'PUBLISHING_PROVIDER_OUTCOME_UNKNOWN',
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
  private isUniqueViolation(error: unknown) {
    if (typeof error !== 'object' || error === null) return false;
    const candidate = error as { code?: unknown; cause?: { code?: unknown } };
    return candidate.code === '23505' || candidate.cause?.code === '23505';
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
