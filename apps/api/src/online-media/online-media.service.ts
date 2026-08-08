import { createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apiAuditLogs, fileAssets, fileFolders } from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import {
  importPortalOnlineMediaSchema,
  portalOnlineMediaSearchQuerySchema,
  type PortalAuthSession,
  type PortalOnlineMediaResult,
  type PortalOnlineMediaSearchResponse,
} from '@workspace/contracts';
import type { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const maximumImportBytes = 25 * 1024 * 1024;
const allowedDownloadHosts: Record<'pexels' | 'unsplash', string[]> = {
  unsplash: ['images.unsplash.com'],
  pexels: ['images.pexels.com', 'videos.pexels.com'],
};

@Injectable()
export class OnlineMediaService {
  private readonly pexelsKey?: string;
  private readonly storageRoot: string;
  private readonly unsplashKey?: string;

  constructor(
    private readonly database: DatabaseService,
    @InjectQueue('file-derivatives') private readonly derivatives: Queue,
    config: ConfigService,
  ) {
    this.pexelsKey = config.get<string>('PEXELS_API_KEY');
    this.unsplashKey = config.get<string>('UNSPLASH_ACCESS_KEY');
    this.storageRoot = resolve(config.getOrThrow<string>('FILES_STORAGE_PATH'));
  }

  async search(
    _session: PortalAuthSession,
    query: unknown,
  ): Promise<PortalOnlineMediaSearchResponse> {
    const parsed = portalOnlineMediaSearchQuerySchema.safeParse(query);
    if (!parsed.success) throw this.invalid();
    const configuredProviders = this.configuredProviders();
    const selected =
      parsed.data.provider === 'auto'
        ? configuredProviders
        : configuredProviders.filter(
            (provider) => provider === parsed.data.provider,
          );
    if (!selected.length) throw this.notConfigured();
    const results = await Promise.all(
      selected.map((provider) =>
        provider === 'unsplash'
          ? this.searchUnsplash(parsed.data)
          : this.searchPexels(parsed.data),
      ),
    );
    const merged = results.flatMap((result) => result.results);
    return {
      results: merged.slice(0, parsed.data.perPage),
      page: parsed.data.page,
      total: results.reduce((sum, result) => sum + result.total, 0),
      configuredProviders,
    };
  }

  async import(session: PortalAuthSession, input: unknown) {
    if (!['owner', 'admin'].includes(session.workspace.role)) {
      throw new AppException(
        'ONLINE_MEDIA_IMPORT_FORBIDDEN',
        HttpStatus.FORBIDDEN,
      );
    }
    const parsed = importPortalOnlineMediaSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    if (parsed.data.folderId) {
      const [folder] = await this.database.db
        .select({ id: fileFolders.id })
        .from(fileFolders)
        .where(
          and(
            eq(fileFolders.id, parsed.data.folderId),
            eq(fileFolders.workspaceId, session.workspace.id),
            eq(fileFolders.status, 'active'),
          ),
        )
        .limit(1);
      if (!folder) throw this.invalid();
    }
    const initialUrl = new URL(parsed.data.downloadUrl);
    this.assertProviderUrl(parsed.data.provider, initialUrl);
    const response = await this.fetchDownload(parsed.data.provider, initialUrl);
    const contentLength = Number(response.headers.get('content-length') ?? '0');
    if (contentLength > maximumImportBytes) throw this.tooLarge();
    const mimeType = normalizedMediaMime(response.headers.get('content-type'));
    if (!mimeType || !mimeMatchesType(mimeType, parsed.data.type)) {
      throw this.invalidBinary();
    }
    const extension = extensionForMime(mimeType);
    const id = crypto.randomUUID();
    const storageKey = `${session.workspace.id}/${id}`;
    const path = resolve(this.storageRoot, storageKey);
    const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
    let receivedBytes = 0;
    const guard = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        receivedBytes += chunk.length;
        callback(
          receivedBytes > maximumImportBytes
            ? new Error('ONLINE_MEDIA_TOO_LARGE')
            : null,
          chunk,
        );
      },
    });
    try {
      if (!response.body) throw this.invalidBinary();
      await mkdir(resolve(path, '..'), { recursive: true });
      await pipeline(
        Readable.fromWeb(response.body as never),
        guard,
        createWriteStream(temporaryPath, { flags: 'wx' }),
      );
      if (!receivedBytes) throw this.invalidBinary();
      await assertMediaSignature(temporaryPath, mimeType);
      await rename(temporaryPath, path);
      const name = safeImportedName(parsed.data.title, extension);
      const [asset] = await this.database.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(fileAssets)
          .values({
            id,
            workspaceId: session.workspace.id,
            folderId: parsed.data.folderId ?? null,
            createdByUserId: session.user.id,
            storageKey,
            name,
            extension,
            mimeType,
            sizeBytes: receivedBytes,
            status: 'ready',
            thumbnailStatus: 'pending',
            metadata: {
              source: 'online-media',
              provider: parsed.data.provider,
              providerId: parsed.data.id,
              sourceUrl: parsed.data.sourceUrl,
              authorName: parsed.data.authorName,
              authorUrl: parsed.data.authorUrl,
            },
          })
          .returning({ id: fileAssets.id });
        if (!created) throw this.failed();
        await tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'online_media.imported',
          subjectType: 'file_asset',
          subjectId: created.id,
          metadata: {
            provider: parsed.data.provider,
            providerId: parsed.data.id,
          },
        });
        return [created];
      });
      if (!asset) throw this.failed();
      await this.derivatives
        .add(
          'generate-thumbnail',
          { assetId: asset.id },
          {
            jobId: `thumbnail-${asset.id}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1_000 },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        )
        .catch(() => undefined);
      return { fileAssetId: asset.id };
    } catch (error) {
      await Promise.all([
        rm(temporaryPath, { force: true }),
        rm(path, { force: true }),
      ]);
      if (error instanceof AppException) throw error;
      if (
        error instanceof Error &&
        error.message === 'ONLINE_MEDIA_TOO_LARGE'
      ) {
        throw this.tooLarge();
      }
      throw this.failed();
    }
  }

  private async searchUnsplash(input: {
    page: number;
    perPage: number;
    q: string;
    type: 'image' | 'video';
  }) {
    if (input.type === 'video') return { results: [], total: 0 };
    const url = new URL('https://api.unsplash.com/search/photos');
    url.search = new URLSearchParams({
      query: input.q,
      page: String(input.page),
      per_page: String(input.perPage),
    }).toString();
    const response = await fetch(url, {
      headers: { authorization: `Client-ID ${this.unsplashKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await providerJson(response);
    if (!response.ok) throw this.providerFailed();
    const rows = Array.isArray(payload.results) ? payload.results : [];
    return {
      total: numberValue(payload.total),
      results: rows
        .map((row) => parseUnsplashResult(row))
        .filter((row): row is PortalOnlineMediaResult => Boolean(row)),
    };
  }

  private async searchPexels(input: {
    page: number;
    perPage: number;
    q: string;
    type: 'image' | 'video';
  }) {
    const url = new URL(
      input.type === 'video'
        ? 'https://api.pexels.com/videos/search'
        : 'https://api.pexels.com/v1/search',
    );
    url.search = new URLSearchParams({
      query: input.q,
      page: String(input.page),
      per_page: String(input.perPage),
    }).toString();
    const response = await fetch(url, {
      headers: { authorization: this.pexelsKey ?? '' },
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await providerJson(response);
    if (!response.ok) throw this.providerFailed();
    const rows = Array.isArray(
      input.type === 'video' ? payload.videos : payload.photos,
    )
      ? ((input.type === 'video'
          ? payload.videos
          : payload.photos) as unknown[])
      : [];
    return {
      total: numberValue(payload.total_results),
      results: rows
        .map((row) => parsePexelsResult(row, input.type))
        .filter((row): row is PortalOnlineMediaResult => Boolean(row)),
    };
  }

  private async fetchDownload(
    provider: 'pexels' | 'unsplash',
    initialUrl: URL,
  ) {
    let url = initialUrl;
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      this.assertProviderUrl(provider, url);
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status < 300 || response.status >= 400) {
        if (!response.ok) throw this.providerFailed();
        return response;
      }
      const location = response.headers.get('location');
      if (!location || redirect === 3) throw this.providerFailed();
      url = new URL(location, url);
    }
    throw this.providerFailed();
  }

  private assertProviderUrl(provider: 'pexels' | 'unsplash', url: URL) {
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !allowedDownloadHosts[provider].some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    ) {
      throw this.invalid();
    }
  }

  private configuredProviders() {
    const providers: Array<'pexels' | 'unsplash'> = [];
    if (this.unsplashKey) providers.push('unsplash');
    if (this.pexelsKey) providers.push('pexels');
    return providers;
  }
  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }
  private notConfigured() {
    return new AppException(
      'ONLINE_MEDIA_PROVIDER_NOT_CONFIGURED',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
  private providerFailed() {
    return new AppException(
      'ONLINE_MEDIA_PROVIDER_FAILED',
      HttpStatus.BAD_GATEWAY,
    );
  }
  private invalidBinary() {
    return new AppException(
      'ONLINE_MEDIA_BINARY_INVALID',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  private tooLarge() {
    return new AppException(
      'ONLINE_MEDIA_TOO_LARGE',
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
  private failed() {
    return new AppException(
      'ONLINE_MEDIA_IMPORT_FAILED',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

async function providerJson(response: Response) {
  const value: unknown = await response.json().catch(() => ({}));
  return isRecord(value) ? value : {};
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringValue(value: unknown) {
  return typeof value === 'string' ? value : null;
}
function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}
function nestedRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? value[key] : null;
}
function parseUnsplashResult(value: unknown): PortalOnlineMediaResult | null {
  if (!isRecord(value)) return null;
  const urls = nestedRecord(value, 'urls');
  const user = nestedRecord(value, 'user');
  const links = nestedRecord(value, 'links');
  const id = stringValue(value.id);
  const previewUrl = stringValue(urls?.small);
  const downloadUrl = stringValue(urls?.full ?? urls?.raw);
  const sourceUrl = stringValue(links?.html);
  if (!id || !previewUrl || !downloadUrl || !sourceUrl) return null;
  return {
    id,
    provider: 'unsplash',
    type: 'image',
    title: stringValue(value.alt_description) ?? `Unsplash ${id}`,
    authorName: stringValue(user?.name) ?? 'Unsplash',
    authorUrl: stringValue(nestedRecord(user, 'links')?.html),
    sourceUrl,
    previewUrl,
    downloadUrl,
    mimeType: 'image/jpeg',
    width: numberValue(value.width) || null,
    height: numberValue(value.height) || null,
  };
}
function parsePexelsResult(
  value: unknown,
  type: 'image' | 'video',
): PortalOnlineMediaResult | null {
  if (!isRecord(value)) return null;
  const id =
    typeof value.id === 'string' || typeof value.id === 'number'
      ? String(value.id)
      : null;
  const sourceUrl = stringValue(value.url);
  if (!id || !sourceUrl) return null;
  if (type === 'image') {
    const src = nestedRecord(value, 'src');
    const previewUrl = stringValue(src?.medium);
    const downloadUrl = stringValue(src?.original);
    if (!previewUrl || !downloadUrl) return null;
    return {
      id,
      provider: 'pexels',
      type,
      title: stringValue(value.alt) ?? `Pexels ${id}`,
      authorName: stringValue(value.photographer) ?? 'Pexels',
      authorUrl: stringValue(value.photographer_url),
      sourceUrl,
      previewUrl,
      downloadUrl,
      mimeType: 'image/jpeg',
      width: numberValue(value.width) || null,
      height: numberValue(value.height) || null,
    };
  }
  const files = Array.isArray(value.video_files)
    ? value.video_files.filter(isRecord)
    : [];
  const selected = files
    .filter(
      (file) =>
        stringValue(file.file_type) === 'video/mp4' && stringValue(file.link),
    )
    .sort(
      (left, right) => numberValue(right.width) - numberValue(left.width),
    )[0];
  const previewUrl = stringValue(value.image);
  const downloadUrl = selected ? stringValue(selected.link) : null;
  if (!previewUrl || !downloadUrl) return null;
  return {
    id,
    provider: 'pexels',
    type,
    title: `Pexels video ${id}`,
    authorName: stringValue(nestedRecord(value, 'user')?.name) ?? 'Pexels',
    authorUrl: null,
    sourceUrl,
    previewUrl,
    downloadUrl,
    mimeType: 'video/mp4',
    width: selected ? numberValue(selected.width) || null : null,
    height: selected ? numberValue(selected.height) || null : null,
  };
}
function normalizedMediaMime(value: string | null) {
  const mime = value?.split(';')[0]?.trim().toLowerCase();
  return ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(
    mime ?? '',
  )
    ? mime!
    : null;
}
function mimeMatchesType(mime: string, type: 'image' | 'video') {
  return mime.startsWith(`${type}/`);
}
function extensionForMime(mime: string) {
  return mime === 'image/jpeg'
    ? 'jpg'
    : mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
        ? 'webp'
        : 'mp4';
}
function safeImportedName(title: string, extension: string) {
  const base =
    basename(title)
      .replace(/[^\p{L}\p{N}._ -]+/gu, '')
      .trim()
      .slice(0, 180) || 'archivo-online';
  return `${base.replace(/\.[^.]+$/, '')}.${extension}`;
}
async function assertMediaSignature(path: string, mime: string) {
  const handle = await open(path, 'r');
  const buffer = Buffer.alloc(32);
  const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
  await handle.close();
  const value = buffer.subarray(0, bytesRead);
  const valid =
    (mime === 'image/jpeg' &&
      value.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
    (mime === 'image/png' &&
      value
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )) ||
    (mime === 'image/webp' &&
      value.subarray(0, 4).toString('ascii') === 'RIFF' &&
      value.subarray(8, 12).toString('ascii') === 'WEBP') ||
    (mime === 'video/mp4' && value.subarray(4, 8).toString('ascii') === 'ftyp');
  if (!valid)
    throw new AppException(
      'ONLINE_MEDIA_BINARY_INVALID',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
}
