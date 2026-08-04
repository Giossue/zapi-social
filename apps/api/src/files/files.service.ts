import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fileAssets, fileFolders, users } from '@workspace/database';
import { and, desc, eq, ilike } from '@workspace/database/query';
import {
  createPortalFileFolderSchema,
  portalFilesQuerySchema,
  startPortalFileUploadSchema,
  updatePortalFileAssetSchema,
  updatePortalFileFolderSchema,
  type PortalAuthSession,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

@Injectable()
export class FilesService {
  private readonly root: string;
  constructor(
    private readonly database: DatabaseService,
    config: ConfigService,
  ) {
    this.root = resolve(config.getOrThrow<string>('FILES_STORAGE_PATH'));
  }
  async list(session: Promise<PortalAuthSession>, query: unknown) {
    const auth = await session;
    const parsed = portalFilesQuerySchema.safeParse(query);
    if (!parsed.success) throw this.invalid();
    const filters = [
      eq(fileAssets.workspaceId, auth.workspace.id),
      eq(fileAssets.status, 'ready'),
    ];
    if (parsed.data.folderId)
      filters.push(eq(fileAssets.folderId, parsed.data.folderId));
    if (parsed.data.starred !== undefined)
      filters.push(eq(fileAssets.starred, parsed.data.starred));
    if (parsed.data.q)
      filters.push(ilike(fileAssets.name, `%${parsed.data.q}%`));
    const [assets, folders] = await Promise.all([
      this.database.db
        .select({ asset: fileAssets, owner: users.displayName })
        .from(fileAssets)
        .innerJoin(users, eq(fileAssets.createdByUserId, users.id))
        .where(and(...filters))
        .orderBy(desc(fileAssets.updatedAt)),
      this.database.db
        .select()
        .from(fileFolders)
        .where(eq(fileFolders.workspaceId, auth.workspace.id))
        .orderBy(desc(fileFolders.updatedAt)),
    ]);
    return {
      canManage: this.canManage(auth),
      folders: folders.map((folder) => ({
        id: folder.id,
        parentFolderId: folder.parentFolderId,
        name: folder.name,
        fileCount: assets.filter(({ asset }) => asset.folderId === folder.id)
          .length,
        sizeBytes: assets
          .filter(({ asset }) => asset.folderId === folder.id)
          .reduce((sum, { asset }) => sum + asset.sizeBytes, 0),
        updatedAt: folder.updatedAt.toISOString(),
      })),
      files: assets.map(({ asset, owner }) => ({
        id: asset.id,
        folderId: asset.folderId,
        name: asset.name,
        kind: this.kind(asset.mimeType),
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        owner,
        ownerInitials: this.initials(owner),
        modifiedAt: asset.updatedAt.toISOString(),
        starred: asset.starred,
      })),
    };
  }
  async createFolder(session: Promise<PortalAuthSession>, input: unknown) {
    const auth = await session;
    this.requireManage(auth);
    const parsed = createPortalFileFolderSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    if (parsed.data.parentFolderId) {
      const [parent] = await this.database.db
        .select({ id: fileFolders.id })
        .from(fileFolders)
        .where(
          and(
            eq(fileFolders.id, parsed.data.parentFolderId),
            eq(fileFolders.workspaceId, auth.workspace.id),
          ),
        )
        .limit(1);
      if (!parent) throw this.notFound();
    }
    const [folder] = await this.database.db
      .insert(fileFolders)
      .values({
        workspaceId: auth.workspace.id,
        createdByUserId: auth.user.id,
        parentFolderId: parsed.data.parentFolderId ?? null,
        name: parsed.data.name,
      })
      .returning();
    if (!folder)
      throw new AppException(
        'REQUEST_FAILED',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
    const [row] = await this.database.db
      .update(fileFolders)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(
        and(
          eq(fileFolders.id, id),
          eq(fileFolders.workspaceId, auth.workspace.id),
        ),
      )
      .returning();
    if (!row) throw this.notFound();
    return row;
  }
  async startUpload(session: Promise<PortalAuthSession>, input: unknown) {
    const auth = await session;
    this.requireManage(auth);
    const parsed = startPortalFileUploadSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const key = `${auth.workspace.id}/${crypto.randomUUID()}`;
    const [asset] = await this.database.db
      .insert(fileAssets)
      .values({
        workspaceId: auth.workspace.id,
        folderId: parsed.data.folderId ?? null,
        createdByUserId: auth.user.id,
        storageKey: key,
        name: basename(parsed.data.name),
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
      })
      .returning();
    if (!asset)
      throw new AppException(
        'REQUEST_FAILED',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
        if (receivedBytes > asset.sizeBytes) {
          callback(this.invalid());
          return;
        }
        callback(null, chunk);
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
      await rename(temporaryPath, path);
      await this.database.db
        .update(fileAssets)
        .set({ status: 'ready', updatedAt: new Date() })
        .where(eq(fileAssets.id, asset.id));
    } catch (error) {
      await rm(temporaryPath, { force: true });
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
    const [asset] = await this.database.db
      .update(fileAssets)
      .set({ ...parsed.data, updatedAt: new Date() })
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
    await this.database.db
      .update(fileAssets)
      .set({ status: 'trashed', trashedAt: new Date(), updatedAt: new Date() })
      .where(eq(fileAssets.id, asset.id));
  }
  async download(session: Promise<PortalAuthSession>, id: string) {
    const asset = await this.asset(await session, id, 'ready');
    const path = this.path(asset.storageKey);
    return {
      mimeType: asset.mimeType,
      name: asset.name,
      stream: createReadStream(path),
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
  private initials(value: string) {
    return value
      .split(/\s+/)
      .map((x) => x[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  private kind(mime: string) {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.includes('spreadsheet') || mime.includes('excel'))
      return 'spreadsheet';
    if (mime.includes('zip') || mime.includes('archive')) return 'archive';
    return 'document' as const;
  }
}
