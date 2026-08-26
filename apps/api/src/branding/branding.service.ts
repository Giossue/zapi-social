import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import crypto from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { platformSettings } from '@workspace/database';
import { eq } from '@workspace/database/query';
import {
  adminBrandingSettingsSchema,
  adminGeneralSettingsSchema,
  brandingAssetSchema,
  type AdminBrandingSettings,
  type BrandingAsset,
  type PublicBranding,
} from '@workspace/contracts';
import { detectFileMime } from '@workspace/file-ingestion';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const MAX_ASSET_BYTES = 2 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

@Injectable()
export class BrandingService {
  private readonly root: string;

  constructor(
    private readonly database: DatabaseService,
    config: ConfigService,
  ) {
    this.root = resolve(
      config.getOrThrow<string>('FILES_STORAGE_PATH'),
      'branding',
    );
  }

  async settings(): Promise<AdminBrandingSettings> {
    return adminBrandingSettingsSchema.parse(await this.group('branding'));
  }

  async save(input: unknown): Promise<AdminBrandingSettings> {
    const parsed = adminBrandingSettingsSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    await this.write('branding', { ...parsed.data });
    return parsed.data;
  }

  async publicBranding(): Promise<PublicBranding> {
    const [branding, general] = await Promise.all([
      this.settings(),
      this.group('general'),
    ]);
    const generalValues = adminGeneralSettingsSchema.parse(general);
    return {
      siteName: generalValues.siteName,
      primaryColor: branding.primaryColor,
      favicon: this.publicUrl('favicon', branding.favicon),
      logoLight: this.publicUrl('logoLight', branding.logoLight),
      logoDark: this.publicUrl('logoDark', branding.logoDark),
      logoBrandLight: this.publicUrl('logoBrandLight', branding.logoBrandLight),
      logoBrandDark: this.publicUrl('logoBrandDark', branding.logoBrandDark),
    };
  }

  async upload(rawAsset: string, stream: NodeJS.ReadableStream) {
    const asset = this.asset(rawAsset);
    const temporaryPath = resolve(this.root, `${crypto.randomUUID()}.part`);
    let received = 0;
    let head: Buffer = Buffer.alloc(0);

    const guard = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        received += chunk.length;
        if (received > MAX_ASSET_BYTES) return callback(this.invalid());
        if (head.length < 64)
          head = Buffer.concat([head, chunk]).subarray(0, 64);
        callback(null, chunk);
      },
    });

    await mkdir(this.root, { recursive: true });
    try {
      await pipeline(
        stream,
        guard,
        createWriteStream(temporaryPath, { flags: 'wx' }),
      );
      if (received === 0) throw this.invalid();

      const mime = this.detect(head);
      const extension = ALLOWED[mime];
      if (!extension) throw this.invalid();

      const version = crypto.randomUUID().slice(0, 8);
      await rename(temporaryPath, resolve(this.root, `${asset}.${extension}`));
      await this.replace(asset, `stored:${extension}:${version}`);
      return { asset, version };
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error instanceof AppException ? error : this.invalid();
    }
  }

  async clear(rawAsset: string) {
    const asset = this.asset(rawAsset);
    const current = (await this.settings())[asset];
    const extension = this.storedExtension(current);
    if (extension) {
      await rm(resolve(this.root, `${asset}.${extension}`), { force: true });
    }
    await this.replace(asset, '');
  }

  async read(rawAsset: string) {
    const asset = this.asset(rawAsset);
    const value = (await this.settings())[asset];
    const extension = this.storedExtension(value);
    if (!extension) throw this.notFound();
    const path = resolve(this.root, `${asset}.${extension}`);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw this.notFound();
    const mime =
      Object.entries(ALLOWED).find(([, value]) => value === extension)?.[0] ??
      'application/octet-stream';
    return { stream: createReadStream(path), mimeType: mime, size: info.size };
  }

  private publicUrl(asset: BrandingAsset, value: string) {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    const version = value.split(':')[2];
    if (!version) return '';
    return `/v1/public/branding/${asset}?v=${version}`;
  }

  private storedExtension(value: string) {
    if (!value.startsWith('stored:')) return null;
    const extension = value.split(':')[1];
    return extension && Object.values(ALLOWED).includes(extension)
      ? extension
      : null;
  }

  private detect(head: Buffer) {
    const detected = detectFileMime(head);
    if (detected && ALLOWED[detected]) return detected;
    const text = head.toString('utf8').trimStart().toLowerCase();
    if (text.startsWith('<svg') || text.startsWith('<?xml')) {
      return 'image/svg+xml';
    }
    return '';
  }

  private asset(value: string): BrandingAsset {
    const parsed = brandingAssetSchema.safeParse(value);
    if (!parsed.success) throw this.notFound();
    return parsed.data;
  }

  private async replace(asset: BrandingAsset, value: string) {
    const current = await this.settings();
    await this.write('branding', { ...current, [asset]: value });
  }

  private async group(key: string) {
    const [row] = await this.database.db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);
    return row?.value ?? {};
  }

  private async write(key: string, value: Record<string, unknown>) {
    await this.database.db
      .insert(platformSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private notFound() {
    return new AppException('PUBLIC_CONTENT_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}
