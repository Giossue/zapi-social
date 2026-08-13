import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  fileAssets,
  fileFolders,
  bulkPostBatches,
  publishingPostMedia,
  publishingPosts,
  publishingWatermarks,
  users,
} from '@workspace/database';
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  sql,
} from '@workspace/database/query';
import {
  createPortalFileFolderSchema,
  portalFilesQuerySchema,
  startPortalFileUploadSchema,
  updatePortalFileAssetSchema,
  updatePortalFileFolderSchema,
  type PortalAuthSession,
} from '@workspace/contracts';
import {
  allowedMime,
  detectFileMime,
  fileKind,
  matchesFileSignature,
} from '@workspace/file-ingestion';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

@Injectable()
export class FilesService {
  private readonly root: string;

  constructor(
    private readonly database: DatabaseService,
    config: ConfigService,
    @InjectQueue('file-derivatives') private readonly derivatives: Queue,
  ) {
    this.root = resolve(config.getOrThrow<string>('FILES_STORAGE_PATH'));
  }

  async list(session: Promise<PortalAuthSession>, query: unknown) {
    const auth = await session;
    const parsed = portalFilesQuerySchema.safeParse(query);
    if (!parsed.success) throw this.invalid();
    return this.library(auth, 'active', parsed.data.q, parsed.data);
  }

  async createFolder(session: Promise<PortalAuthSession>, input: unknown) {
    const auth = await session;
    this.requireManage(auth);
    const parsed = createPortalFileFolderSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const parentFolderId = parsed.data.parentFolderId ?? null;
    if (parentFolderId) await this.folder(auth, parentFolderId, 'active');
    await this.assertFolderNameAvailable(
      auth.workspace.id,
      parsed.data.name,
      parentFolderId,
    );
    const [folder] = await this.database.db
      .insert(fileFolders)
      .values({
        workspaceId: auth.workspace.id,
        createdByUserId: auth.user.id,
        parentFolderId,
        name: parsed.data.name,
      })
      .returning();
    if (!folder) throw this.failed();
    return folder;
  }

  async updateFolder(
    session: Promise<PortalAuthSession>,
    id: string,
    input: unknown,
  ) {
    const auth = await session;
    this.requireManage(auth);
    const parsed = updatePortalFileFolderSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const current = await this.folder(auth, id, 'active');
    const parentFolderId =
      parsed.data.parentFolderId === undefined
        ? current.parentFolderId
        : parsed.data.parentFolderId;
    if (parentFolderId) {
      await this.folder(auth, parentFolderId, 'active');
      const descendants = await this.folderDescendants(
        auth.workspace.id,
        current.id,
      );
      if (descendants.has(parentFolderId)) throw this.invalid();
    }
    const name = parsed.data.name ?? current.name;
    await this.assertFolderNameAvailable(
      auth.workspace.id,
      name,
      parentFolderId,
      current.id,
    );
    const [folder] = await this.database.db
      .update(fileFolders)
      .set({
        name,
        parentFolderId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fileFolders.id, current.id),
          eq(fileFolders.workspaceId, auth.workspace.id),
          eq(fileFolders.status, 'active'),
        ),
      )
      .returning();
    if (!folder) throw this.notFound();
    return folder;
  }

  async removeFolder(session: Promise<PortalAuthSession>, id: string) {
    const auth = await session;
    this.requireManage(auth);
    const folder = await this.folder(auth, id, 'active');
    const folderIds = [
      ...(await this.folderDescendants(auth.workspace.id, folder.id)),
    ];
    await this.assertAssetsUnused(auth.workspace.id, folderIds, true);
    const assets = await this.database.db
      .select()
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.workspaceId, auth.workspace.id),
          inArray(fileAssets.folderId, folderIds),
        ),
      );
    await this.removePhysicalAssets(assets);
    await this.database.db.transaction(async (tx) => {
      if (assets.length)
        await tx.delete(fileAssets).where(
          inArray(
            fileAssets.id,
            assets.map((asset) => asset.id),
          ),
        );
      await tx
        .delete(fileFolders)
        .where(
          and(
            eq(fileFolders.workspaceId, auth.workspace.id),
            inArray(fileFolders.id, folderIds),
          ),
        );
    });
  }

  async startUpload(session: Promise<PortalAuthSession>, input: unknown) {
    const auth = await session;
    this.requireManage(auth);
    const parsed = startPortalFileUploadSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const name = basename(parsed.data.name);
    const extension = extname(name).slice(1).toLowerCase();
    const mimeType = allowedMime(extension, parsed.data.mimeType);
    if (!mimeType) throw this.invalid();
    if (parsed.data.folderId)
      await this.folder(auth, parsed.data.folderId, 'active');
    const storageKey = `${auth.workspace.id}/${crypto.randomUUID()}`;
    const [asset] = await this.database.db
      .insert(fileAssets)
      .values({
        workspaceId: auth.workspace.id,
        folderId: parsed.data.folderId ?? null,
        createdByUserId: auth.user.id,
        storageKey,
        name,
        extension,
        mimeType,
        sizeBytes: parsed.data.sizeBytes,
        thumbnailStatus:
          mimeType.startsWith('image/') || mimeType.startsWith('video/')
            ? 'pending'
            : 'not_applicable',
      })
      .returning();
    if (!asset) throw this.failed();
    return { id: asset.id, uploadUrl: `/v1/portal/files/${asset.id}/upload` };
  }

  async upload(
    session: Promise<PortalAuthSession>,
    id: string,
    stream: NodeJS.ReadableStream,
  ) {
    const auth = await session;
    this.requireManage(auth);
    const asset = await this.asset(auth, id, 'pending');
    const path = this.path(asset.storageKey);
    const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
    let receivedBytes = 0;
    const guard = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        receivedBytes += chunk.length;
        callback(
          receivedBytes > asset.sizeBytes ? this.invalid() : null,
          chunk,
        );
      },
    });
    try {
      await mkdir(resolve(path, '..'), { recursive: true });
      await pipeline(
        stream,
        guard,
        createWriteStream(temporaryPath, { flags: 'wx' }),
      );
      if (receivedBytes !== asset.sizeBytes) throw this.invalid();
      await this.assertBinaryMatches(
        asset.extension ?? '',
        asset.mimeType,
        temporaryPath,
      );
      await rename(temporaryPath, path);
      await this.database.db
        .update(fileAssets)
        .set({ status: 'ready', updatedAt: new Date() })
        .where(eq(fileAssets.id, asset.id));
    } catch (error) {
      await Promise.all([
        rm(temporaryPath, { force: true }),
        rm(path, { force: true }),
      ]);
      await this.database.db
        .delete(fileAssets)
        .where(
          and(
            eq(fileAssets.id, asset.id),
            eq(fileAssets.workspaceId, auth.workspace.id),
            eq(fileAssets.status, 'pending'),
          ),
        );
      throw error;
    }
    if (asset.thumbnailStatus !== 'pending') return;
    try {
      await this.derivatives.add(
        'generate-thumbnail',
        { assetId: asset.id },
        {
          jobId: `thumbnail-${asset.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch {
      // The asset is already ready; the Worker backfill retries this pending
      // derivative at its next boot without discarding the uploaded original.
    }
  }

  async updateAsset(
    session: Promise<PortalAuthSession>,
    id: string,
    input: unknown,
  ) {
    const auth = await session;
    this.requireManage(auth);
    const parsed = updatePortalFileAssetSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    if (parsed.data.folderId)
      await this.folder(auth, parsed.data.folderId, 'active');
    const current = await this.asset(auth, id, 'ready');
    const name = parsed.data.name
      ? this.withOriginalExtension(parsed.data.name, current.extension)
      : undefined;
    const [asset] = await this.database.db
      .update(fileAssets)
      .set({ ...parsed.data, name, updatedAt: new Date() })
      .where(
        and(
          eq(fileAssets.id, id),
          eq(fileAssets.workspaceId, auth.workspace.id),
          eq(fileAssets.status, 'ready'),
        ),
      )
      .returning();
    if (!asset) throw this.notFound();
    return asset;
  }

  async remove(session: Promise<PortalAuthSession>, id: string) {
    const auth = await session;
    this.requireManage(auth);
    const asset = await this.asset(auth, id, 'ready');
    await this.assertAssetsUnused(auth.workspace.id, [asset.id]);
    await this.removePhysicalAssets([asset]);
    await this.database.db
      .delete(fileAssets)
      .where(
        and(
          eq(fileAssets.id, asset.id),
          eq(fileAssets.workspaceId, auth.workspace.id),
          eq(fileAssets.status, 'ready'),
        ),
      );
  }

  async download(session: Promise<PortalAuthSession>, id: string) {
    const asset = await this.asset(await session, id, 'ready');
    return {
      mimeType: asset.mimeType,
      name: asset.name,
      stream: createReadStream(this.path(asset.storageKey)),
    };
  }

  async preview(
    session: Promise<PortalAuthSession>,
    id: string,
    range?: string,
  ) {
    const asset = await this.asset(await session, id, 'ready');
    const path = this.path(asset.storageKey);
    const info = await stat(path);
    const match = range?.match(/bytes=(\d*)-(\d*)/);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2]
      ? Math.min(Number(match[2]), info.size - 1)
      : info.size - 1;
    if (start < 0 || end < start || start >= info.size) throw this.invalid();
    return {
      mimeType: asset.mimeType,
      name: asset.name,
      size: info.size,
      start,
      end,
      partial: Boolean(match),
      stream: createReadStream(path, { start, end }),
    };
  }

  async thumbnail(session: Promise<PortalAuthSession>, id: string) {
    const asset = await this.asset(await session, id, 'ready');
    if (asset.thumbnailStatus !== 'ready' || !asset.thumbnailKey)
      throw this.notFound();
    return {
      mimeType: 'image/webp',
      name: `${asset.name}.webp`,
      stream: createReadStream(this.path(asset.thumbnailKey)),
    };
  }

  private async library(
    auth: PortalAuthSession,
    status: 'active',
    q?: string,
    query?: {
      folderId?: string;
      starred?: boolean;
      kind?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const assetStatus = 'ready';
    const filters = [
      eq(fileAssets.workspaceId, auth.workspace.id),
      eq(fileAssets.status, assetStatus),
    ];
    const folderFilters = [
      eq(fileFolders.workspaceId, auth.workspace.id),
      eq(fileFolders.status, status),
    ];
    if (query?.folderId) {
      filters.push(eq(fileAssets.folderId, query.folderId));
      folderFilters.push(eq(fileFolders.parentFolderId, query.folderId));
    } else {
      filters.push(isNull(fileAssets.folderId));
      folderFilters.push(isNull(fileFolders.parentFolderId));
    }
    if (query?.starred !== undefined)
      filters.push(eq(fileAssets.starred, query.starred));
    if (q) {
      filters.push(ilike(fileAssets.name, `%${q}%`));
      folderFilters.push(ilike(fileFolders.name, `%${q}%`));
    }
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;
    const offset = (page - 1) * limit;
    const [assets, folders, [filesCount], [foldersCount]] = await Promise.all([
      this.database.db
        .select({ asset: fileAssets, owner: users.displayName })
        .from(fileAssets)
        .innerJoin(users, eq(fileAssets.createdByUserId, users.id))
        .where(and(...filters))
        .orderBy(desc(fileAssets.updatedAt))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select()
        .from(fileFolders)
        .where(and(...folderFilters))
        .orderBy(desc(fileFolders.updatedAt))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ count: sql<number>`count(*)::int` })
        .from(fileAssets)
        .where(and(...filters)),
      this.database.db
        .select({ count: sql<number>`count(*)::int` })
        .from(fileFolders)
        .where(and(...folderFilters)),
    ]);
    const visibleAssets = query?.kind
      ? assets.filter(({ asset }) => fileKind(asset.mimeType) === query.kind)
      : assets;
    return {
      canManage: this.canManage(auth),
      page,
      limit,
      foldersTotal: foldersCount?.count ?? 0,
      filesTotal: filesCount?.count ?? 0,
      folders: folders.map((folder) => ({
        id: folder.id,
        parentFolderId: folder.parentFolderId,
        name: folder.name,
        fileCount: visibleAssets.filter(
          ({ asset }) => asset.folderId === folder.id,
        ).length,
        sizeBytes: visibleAssets
          .filter(({ asset }) => asset.folderId === folder.id)
          .reduce((sum, { asset }) => sum + asset.sizeBytes, 0),
        updatedAt: folder.updatedAt.toISOString(),
      })),
      files: visibleAssets.map(({ asset, owner }) =>
        this.serializeAsset(asset, owner),
      ),
    };
  }

  private serializeAsset(asset: typeof fileAssets.$inferSelect, owner: string) {
    return {
      id: asset.id,
      folderId: asset.folderId,
      name: asset.name,
      kind: fileKind(asset.mimeType),
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      owner,
      ownerInitials: this.initials(owner),
      modifiedAt: asset.updatedAt.toISOString(),
      starred: asset.starred,
      thumbnailStatus: asset.thumbnailStatus,
    };
  }

  private async asset(
    auth: PortalAuthSession,
    id: string,
    status: 'pending' | 'ready',
  ) {
    const [asset] = await this.database.db
      .select()
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.id, id),
          eq(fileAssets.workspaceId, auth.workspace.id),
          eq(fileAssets.status, status),
        ),
      )
      .limit(1);
    if (!asset) throw this.notFound();
    return asset;
  }

  private async folder(auth: PortalAuthSession, id: string, status: 'active') {
    const [folder] = await this.database.db
      .select()
      .from(fileFolders)
      .where(
        and(
          eq(fileFolders.id, id),
          eq(fileFolders.workspaceId, auth.workspace.id),
          eq(fileFolders.status, status),
        ),
      )
      .limit(1);
    if (!folder) throw this.notFound();
    return folder;
  }

  private async folderExists(
    workspaceId: string,
    id: string,
    status: 'active',
  ) {
    const [folder] = await this.database.db
      .select({ id: fileFolders.id })
      .from(fileFolders)
      .where(
        and(
          eq(fileFolders.id, id),
          eq(fileFolders.workspaceId, workspaceId),
          eq(fileFolders.status, status),
        ),
      )
      .limit(1);
    return Boolean(folder);
  }

  private async folderDescendants(workspaceId: string, rootId: string) {
    const rows = await this.database.db
      .select({
        id: fileFolders.id,
        parentFolderId: fileFolders.parentFolderId,
      })
      .from(fileFolders)
      .where(eq(fileFolders.workspaceId, workspaceId));
    const children = new Map<string, string[]>();
    for (const row of rows)
      if (row.parentFolderId)
        children.set(row.parentFolderId, [
          ...(children.get(row.parentFolderId) ?? []),
          row.id,
        ]);
    const descendants = new Set([rootId]);
    const pending = [rootId];
    while (pending.length)
      for (const id of children.get(pending.pop()!) ?? [])
        if (!descendants.has(id)) {
          descendants.add(id);
          pending.push(id);
        }
    return descendants;
  }

  private async assertFolderNameAvailable(
    workspaceId: string,
    name: string,
    parentFolderId: string | null,
    excludingId?: string,
  ) {
    const siblings = await this.database.db
      .select({ id: fileFolders.id, name: fileFolders.name })
      .from(fileFolders)
      .where(
        and(
          eq(fileFolders.workspaceId, workspaceId),
          parentFolderId
            ? eq(fileFolders.parentFolderId, parentFolderId)
            : isNull(fileFolders.parentFolderId),
        ),
      );
    if (
      siblings.some(
        (folder) =>
          folder.id !== excludingId &&
          folder.name.localeCompare(name, undefined, {
            sensitivity: 'accent',
          }) === 0,
      )
    )
      throw this.invalid();
  }

  private async assertAssetsUnused(
    workspaceId: string,
    ids: string[],
    folders = false,
  ) {
    const assetIds = folders
      ? (
          await this.database.db
            .select({ id: fileAssets.id })
            .from(fileAssets)
            .where(
              and(
                eq(fileAssets.workspaceId, workspaceId),
                inArray(fileAssets.folderId, ids),
              ),
            )
        ).map((asset) => asset.id)
      : ids;
    if (!assetIds.length) return;
    const [[publishingReference], [watermarkReference], [bulkReference]] =
      await Promise.all([
        this.database.db
          .select({ id: publishingPostMedia.id })
          .from(publishingPostMedia)
          .innerJoin(
            publishingPosts,
            eq(publishingPostMedia.publishingPostId, publishingPosts.id),
          )
          .where(
            and(
              eq(publishingPosts.workspaceId, workspaceId),
              inArray(publishingPostMedia.fileAssetId, assetIds),
            ),
          )
          .limit(1),
        this.database.db
          .select({ id: publishingWatermarks.id })
          .from(publishingWatermarks)
          .where(
            and(
              eq(publishingWatermarks.workspaceId, workspaceId),
              inArray(publishingWatermarks.imageFileAssetId, assetIds),
            ),
          )
          .limit(1),
        this.database.db
          .select({ id: bulkPostBatches.id })
          .from(bulkPostBatches)
          .where(
            and(
              eq(bulkPostBatches.workspaceId, workspaceId),
              inArray(bulkPostBatches.sourceFileAssetId, assetIds),
            ),
          )
          .limit(1),
      ]);
    if (publishingReference)
      throw new AppException('FILE_IN_USE_BY_PUBLISHING', HttpStatus.CONFLICT);
    if (watermarkReference)
      throw new AppException('FILE_IN_USE_BY_WATERMARK', HttpStatus.CONFLICT);
    if (bulkReference)
      throw new AppException('FILE_IN_USE_BY_BULK_POSTS', HttpStatus.CONFLICT);
  }

  private async removePhysicalAssets(
    assets: Array<typeof fileAssets.$inferSelect>,
  ) {
    await Promise.all(
      assets.flatMap((asset) => [
        rm(this.path(asset.storageKey), { force: true }),
        ...(asset.thumbnailKey
          ? [rm(this.path(asset.thumbnailKey), { force: true })]
          : []),
      ]),
    );
  }

  private async assertBinaryMatches(
    extension: string,
    expectedMime: string,
    path: string,
  ) {
    const handle = await open(path, 'r');
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    await handle.close();
    const detected = detectFileMime(buffer.subarray(0, bytesRead));
    const expected = allowedMime(extension, expectedMime);
    if (
      !expected ||
      !detected ||
      !matchesFileSignature(extension, expected, detected)
    )
      throw this.invalid();
  }

  private withOriginalExtension(name: string, extension: string | null) {
    const clean = basename(name).replace(
      new RegExp(`${extension ? `\\.${extension}` : ''}$`, 'i'),
      '',
    );
    return extension ? `${clean}.${extension}` : clean;
  }
  private path(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}/`)) throw this.invalid();
    return path;
  }
  private canManage(auth: PortalAuthSession) {
    return auth.workspace.role === 'owner' || auth.workspace.role === 'admin';
  }
  private requireManage(auth: PortalAuthSession) {
    if (!this.canManage(auth))
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
  private initials(value: string) {
    return value
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}
