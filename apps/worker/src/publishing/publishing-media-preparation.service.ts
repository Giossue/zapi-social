import { publishVariantStorageKey } from '@workspace/file-ingestion';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  fileAssets,
  publishingPosts,
  publishingWatermarks,
  socialAccounts,
} from '@workspace/database';
import { and, desc, eq, isNull, or, sql } from '@workspace/database/query';
import sharp from 'sharp';
import { DatabaseService } from '../database/database.service';

const execute = promisify(execFile);
const maximumTextLines = 3;
type Asset = typeof fileAssets.$inferSelect;
type Post = typeof publishingPosts.$inferSelect;
type Account = typeof socialAccounts.$inferSelect;
type Rule = typeof publishingWatermarks.$inferSelect;

export type PreparedPublishingAsset = Asset & { publicVariant?: string };

@Injectable()
export class PublishingMediaPreparationService {
  private readonly storageRoot: string;

  constructor(
    private readonly database: DatabaseService,
    config: ConfigService,
  ) {
    this.storageRoot = resolve(
      config.get<string>('FILES_STORAGE_PATH') ?? './.data/files',
    );
  }

  async prepare(post: Post, account: Account, assets: Asset[]) {
    const rule = await this.rule(post.workspaceId, account.id);
    if (!rule || !assets.length) {
      return {
        assets: assets as PreparedPublishingAsset[],
        cleanup: () => Promise.resolve(),
      };
    }
    const prepared: PreparedPublishingAsset[] = [];
    const paths: string[] = [];
    const cleanup = async () => {
      await Promise.allSettled(paths.map((path) => rm(path, { force: true })));
    };
    let completed = false;
    try {
      for (const asset of assets) {
        const targetKey = publishVariantStorageKey({
          workspaceId: asset.workspaceId,
          assetId: asset.id,
          postId: post.id,
          extension: asset.storageKey,
        });
        const targetPath = this.path(targetKey);
        await mkdir(resolve(targetPath, '..'), { recursive: true });
        const isImage = asset.mimeType.startsWith('image/');
        const isVideo = asset.mimeType.startsWith('video/');
        if (!isImage && !isVideo) {
          prepared.push(asset);
          continue;
        }
        paths.push(targetPath);
        if (isImage) {
          await this.prepareImage(asset, rule, targetPath);
        } else {
          await this.prepareVideo(asset, rule, targetPath);
        }
        const information = await stat(targetPath);
        prepared.push({
          ...asset,
          storageKey: targetKey,
          sizeBytes: information.size,
          mimeType:
            asset.mimeType.startsWith('video/') &&
            asset.mimeType !== 'video/webm'
              ? 'video/mp4'
              : asset.mimeType,
          publicVariant: post.id,
        });
      }
      completed = true;
      return {
        assets: prepared,
        cleanup,
      };
    } finally {
      if (!completed) await cleanup();
    }
  }

  private async rule(workspaceId: string, accountId: string) {
    const rows = await this.database.db
      .select()
      .from(publishingWatermarks)
      .where(
        and(
          eq(publishingWatermarks.workspaceId, workspaceId),
          or(
            eq(publishingWatermarks.socialAccountId, accountId),
            isNull(publishingWatermarks.socialAccountId),
          ),
        ),
      )
      .orderBy(desc(sql`${publishingWatermarks.socialAccountId} is not null`))
      .limit(1);
    return rows[0] ?? null;
  }

  private async prepareImage(asset: Asset, rule: Rule, targetPath: string) {
    const sourcePath = this.path(asset.storageKey);
    const metadata = await sharp(sourcePath).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) {
      throw new Error('PUBLISHING_WATERMARK_SOURCE_INVALID');
    }
    const rotated = (metadata.orientation ?? 0) >= 5;
    const frameWidth = rotated ? metadata.height : metadata.width;
    const frameHeight = rotated ? metadata.width : metadata.height;
    const overlay = await this.overlay(rule, frameWidth, frameHeight);
    const position = overlayPosition(
      rule.position,
      frameWidth,
      frameHeight,
      overlay.width,
      overlay.height,
    );
    await sharp(sourcePath)
      .rotate()
      .composite([{ input: overlay.buffer, ...position }])
      .toFormat(metadata.format)
      .toFile(targetPath);
  }

  private async prepareVideo(asset: Asset, rule: Rule, targetPath: string) {
    const sourcePath = this.path(asset.storageKey);
    const dimensions = await videoDimensions(sourcePath);
    const overlay = await this.overlay(
      rule,
      dimensions.width,
      dimensions.height,
    );
    const overlayPath = `${targetPath}.overlay.png`;
    try {
      await writeFile(overlayPath, overlay.buffer);
      const expression = ffmpegOverlayPosition(
        rule.position,
        dimensions.width,
        dimensions.height,
        overlay.width,
        overlay.height,
      );
      const webm = asset.mimeType === 'video/webm';
      await execute(
        'ffmpeg',
        [
          '-y',
          '-i',
          sourcePath,
          '-i',
          overlayPath,
          '-filter_complex',
          `[0:v][1:v]overlay=${expression}`,
          '-map',
          '0:a?',
          '-c:v',
          webm ? 'libvpx-vp9' : 'libx264',
          '-c:a',
          webm ? 'libopus' : 'aac',
          ...(webm ? ['-f', 'webm'] : ['-movflags', '+faststart', '-f', 'mp4']),
          targetPath,
        ],
        { maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60_000 },
      );
    } finally {
      await rm(overlayPath, { force: true });
    }
  }

  private async overlay(rule: Rule, frameWidth: number, frameHeight: number) {
    const bounds = overlayBounds(frameWidth, frameHeight);
    const targetWidth = Math.min(
      bounds.width,
      Math.max(
        Math.min(48, bounds.width),
        Math.round((frameWidth * rule.scalePercent) / 100),
      ),
    );
    const opacity = rule.opacityPercent / 100;
    if (rule.type === 'image' && rule.imageFileAssetId) {
      const [asset] = await this.database.db
        .select()
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.id, rule.imageFileAssetId),
            eq(fileAssets.workspaceId, rule.workspaceId),
            eq(fileAssets.status, 'ready'),
          ),
        )
        .limit(1);
      if (!asset) throw new Error('PUBLISHING_WATERMARK_ASSET_MISSING');
      const source = await readFile(this.path(asset.storageKey));
      const resized = await sharp(source)
        .resize({
          width: targetWidth,
          height: bounds.height,
          fit: 'inside',
          withoutEnlargement: false,
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      const svg = `<svg width="${resized.info.width}" height="${resized.info.height}" xmlns="http://www.w3.org/2000/svg"><image width="100%" height="100%" opacity="${opacity}" href="data:image/png;base64,${resized.data.toString('base64')}"/></svg>`;
      return {
        buffer: Buffer.from(svg),
        width: resized.info.width,
        height: resized.info.height,
      };
    }
    const preferredFontSize = Math.max(8, Math.round(targetWidth * 0.16));
    const maximumFontByHeight = Math.max(
      1,
      Math.floor(bounds.height / (maximumTextLines * 1.25 + 1.1)),
    );
    const maximumFontByWidth = Math.max(1, Math.floor(targetWidth / 3));
    const fontSize = Math.min(
      preferredFontSize,
      maximumFontByHeight,
      maximumFontByWidth,
    );
    const padding = Math.min(
      Math.max(1, Math.round(fontSize * 0.55)),
      Math.max(0, Math.floor((targetWidth - 1) / 2)),
    );
    const maximumCharacters = Math.max(
      1,
      Math.floor(
        Math.max(1, targetWidth - padding * 2) / Math.max(1, fontSize * 0.62),
      ),
    );
    const lines = wrapTextLines(
      rule.text ?? '',
      maximumCharacters,
      maximumTextLines,
    );
    const lineHeight = Math.max(1, Math.round(fontSize * 1.25));
    const overlayHeight = Math.min(
      bounds.height,
      padding * 2 + lines.length * lineHeight,
    );
    const foreground = textColor(rule.textColor);
    const background =
      rule.textPreset === 'solid-light'
        ? 'rgba(255,255,255,0.9)'
        : rule.textPreset === 'minimal'
          ? 'transparent'
          : 'rgba(10,10,10,0.72)';
    const firstBaseline = Math.min(
      overlayHeight,
      padding + Math.max(1, fontSize),
    );
    const text = lines
      .map(
        (line, index) =>
          `<tspan x="50%" y="${Math.min(overlayHeight, firstBaseline + index * lineHeight)}">${escapeXml(line)}</tspan>`,
      )
      .join('');
    const svg = `<svg width="${targetWidth}" height="${overlayHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="${Math.round(fontSize * 0.45)}" fill="${background}" opacity="${opacity}"/><text text-anchor="middle" fill="${foreground}" fill-opacity="${opacity}" font-family="sans-serif" font-size="${fontSize}" font-weight="${fontWeight(rule.textWeight)}">${text}</text></svg>`;
    return {
      buffer: Buffer.from(svg),
      width: targetWidth,
      height: overlayHeight,
    };
  }

  private path(storageKey: string) {
    const path = resolve(this.storageRoot, storageKey);
    if (!path.startsWith(`${this.storageRoot}/`)) {
      throw new Error('PUBLISHING_STORAGE_PATH_INVALID');
    }
    return path;
  }
}

function overlayPosition(
  position: Rule['position'],
  width: number,
  height: number,
  overlayWidth: number,
  overlayHeight: number,
) {
  const margin = overlayMargin(width, height);
  const left = position.includes('left')
    ? margin
    : position.includes('right')
      ? width - overlayWidth - margin
      : Math.round((width - overlayWidth) / 2);
  const top = position.includes('top')
    ? margin
    : position.includes('bottom')
      ? height - overlayHeight - margin
      : Math.round((height - overlayHeight) / 2);
  return { left: Math.max(0, left), top: Math.max(0, top) };
}

function ffmpegOverlayPosition(
  position: Rule['position'],
  width: number,
  height: number,
  overlayWidth: number,
  overlayHeight: number,
) {
  const coordinates = overlayPosition(
    position,
    width,
    height,
    overlayWidth,
    overlayHeight,
  );
  return `${coordinates.left}:${coordinates.top}`;
}

function overlayMargin(width: number, height: number) {
  const shortestSide = Math.min(width, height);
  return Math.min(
    Math.max(12, Math.round(shortestSide * 0.025)),
    Math.max(0, Math.floor((shortestSide - 1) / 2)),
  );
}

function overlayBounds(width: number, height: number) {
  const margin = overlayMargin(width, height);
  return {
    width: Math.max(1, width - margin * 2),
    height: Math.max(1, height - margin * 2),
  };
}

export function wrapTextLines(
  value: string,
  maximumCharacters: number,
  maximumLines: number,
) {
  const characterLimit = Math.max(1, Math.floor(maximumCharacters));
  const lineLimit = Math.max(1, Math.floor(maximumLines));
  const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [''];

  const allLines: string[] = [];
  let current = '';
  for (const originalWord of words) {
    let word = originalWord;
    while (characterCount(word) > characterLimit) {
      if (current) {
        allLines.push(current);
        current = '';
      }
      allLines.push(takeCharacters(word, characterLimit));
      word = dropCharacters(word, characterLimit);
    }
    if (!word) continue;
    const candidate = current ? `${current} ${word}` : word;
    if (characterCount(candidate) <= characterLimit) {
      current = candidate;
    } else {
      if (current) allLines.push(current);
      current = word;
    }
  }
  if (current) allLines.push(current);

  const lines = allLines.slice(0, lineLimit);
  if (allLines.length > lineLimit) {
    const lastIndex = lines.length - 1;
    const last = lines[lastIndex] ?? '';
    lines[lastIndex] =
      characterLimit === 1
        ? '…'
        : `${takeCharacters(last, characterLimit - 1).trimEnd()}…`;
  }
  return lines;
}

function characterCount(value: string) {
  return Array.from(value).length;
}

function takeCharacters(value: string, count: number) {
  return Array.from(value).slice(0, count).join('');
}

function dropCharacters(value: string, count: number) {
  return Array.from(value).slice(count).join('');
}

async function videoDimensions(path: string) {
  const { stdout } = await execute(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'json',
      path,
    ],
    { timeout: 30_000 },
  );
  const parsed = JSON.parse(stdout) as unknown;
  const streams =
    isRecord(parsed) && Array.isArray(parsed.streams)
      ? (parsed.streams as unknown[])
      : [];
  const stream = streams[0];
  if (!isRecord(stream)) {
    throw new Error('PUBLISHING_VIDEO_DIMENSIONS_INVALID');
  }
  const { width, height } = stream;
  if (typeof width !== 'number' || typeof height !== 'number') {
    throw new Error('PUBLISHING_VIDEO_DIMENSIONS_INVALID');
  }
  return { width, height };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function textColor(value: Rule['textColor']) {
  if (value === 'dark') return '#111827';
  if (value === 'ocean-gradient') return '#38bdf8';
  if (value === 'sunset-gradient') return '#fb7185';
  if (value === 'brand-gradient') return '#a78bfa';
  return '#ffffff';
}

function fontWeight(value: Rule['textWeight']) {
  return value === 'bold' ? 700 : value === 'semibold' ? 600 : 500;
}
