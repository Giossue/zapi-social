import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PlatformAdminAuthSession,
  PortalAuthSession,
} from '@workspace/contracts';
import { apiAuditLogs, users } from '@workspace/database';
import { eq } from '@workspace/database/query';
import {
  MAX_AVATAR_BYTES,
  avatarMimeExtensions,
  detectFileMime,
  storageExtension,
  userAvatarStorageKey,
  userAvatarStoragePrefix,
} from '@workspace/file-ingestion';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

type ProfileSession = PlatformAdminAuthSession | PortalAuthSession;

@Injectable()
export class ProfileAvatarService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  private get root() {
    return resolve(this.config.getOrThrow<string>('FILES_STORAGE_PATH'));
  }

  urlFor(area: 'admin' | 'portal', avatarPath: string | null) {
    if (!avatarPath) return null;
    const version = this.versionOf(avatarPath);
    if (!version) return null;
    return `/v1/${area}/profile/avatar?v=${version}`;
  }

  async upload(session: ProfileSession, stream: NodeJS.ReadableStream) {
    const userId = session.user.id;
    const directory = resolve(this.root, userAvatarStoragePrefix(userId));
    const temporaryPath = resolve(directory, `${crypto.randomUUID()}.part`);
    let received = 0;
    let head: Buffer = Buffer.alloc(0);

    const guard = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        received += chunk.length;
        if (received > MAX_AVATAR_BYTES) return callback(this.invalid());
        if (head.length < 64)
          head = Buffer.concat([head, chunk]).subarray(0, 64);
        callback(null, chunk);
      },
    });

    await mkdir(directory, { recursive: true });
    try {
      await pipeline(
        stream,
        guard,
        createWriteStream(temporaryPath, { flags: 'wx' }),
      );
      if (received === 0) throw this.invalid();

      const mime = detectFileMime(head);
      const extension = mime ? avatarMimeExtensions[mime] : undefined;
      if (!extension) throw this.invalid();

      const version = crypto.randomUUID().slice(0, 8);
      const key = userAvatarStorageKey({ userId, version, extension });
      const previousPath = await this.currentPath(userId);
      await rename(temporaryPath, resolve(this.root, key));

      const [updated] = await this.database.db
        .update(users)
        .set({ avatarPath: key, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning({ id: users.id });
      if (!updated) {
        await rm(resolve(this.root, key), { force: true });
        throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);
      }

      if (previousPath && previousPath !== key) {
        await rm(this.resolveKey(previousPath), { force: true });
      }

      await this.audit(session, 'profile.avatar_updated');
      return { avatarUrl: this.urlFor(session.area, key) };
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error instanceof AppException ? error : this.invalid();
    }
  }

  async remove(session: ProfileSession) {
    const userId = session.user.id;
    const current = await this.currentPath(userId);
    if (!current) return;

    await this.database.db
      .update(users)
      .set({ avatarPath: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await rm(this.resolveKey(current), { force: true });
    await this.audit(session, 'profile.avatar_removed');
  }

  async read(session: ProfileSession) {
    const current = await this.currentPath(session.user.id);
    if (!current) throw this.notFound();

    const extension = storageExtension(current);
    const mime = Object.entries(avatarMimeExtensions).find(
      ([, value]) => value === extension,
    )?.[0];
    if (!mime) throw this.notFound();

    const path = this.resolveKey(current);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw this.notFound();

    return { stream: createReadStream(path), mimeType: mime, size: info.size };
  }

  private async currentPath(userId: string) {
    const [row] = await this.database.db
      .select({ avatarPath: users.avatarPath })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.avatarPath ?? null;
  }

  private resolveKey(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root)) throw this.invalid();
    return path;
  }

  private versionOf(avatarPath: string) {
    const filename = avatarPath.split('/').at(-1) ?? '';
    return filename.split('.')[0] ?? null;
  }

  private async audit(session: ProfileSession, event: string) {
    await this.database.db.insert(apiAuditLogs).values({
      workspaceId: session.area === 'portal' ? session.workspace.id : null,
      actorUserId: session.user.id,
      event,
      subjectType: 'user',
      subjectId: session.user.id,
      metadata: {},
    });
  }

  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private notFound() {
    return new AppException('REQUEST_FAILED', HttpStatus.NOT_FOUND);
  }
}
