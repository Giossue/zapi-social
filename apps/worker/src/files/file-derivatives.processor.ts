import {
  temporaryStorageKey,
  thumbnailStorageKey,
} from '@workspace/file-ingestion';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { fileAssets } from '@workspace/database';
import { eq } from '@workspace/database/query';
import { mkdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import type { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { WorkerAuditService } from '../audit/worker-audit.service';
import {
  FILE_DERIVATIVES_JOB,
  FILE_DERIVATIVES_QUEUE,
  type FileDerivativesJobData,
} from './file-derivatives.constants';

@Injectable()
@Processor(FILE_DERIVATIVES_QUEUE, { concurrency: 2 })
export class FileDerivativesProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: WorkerAuditService,
    config: ConfigService,
  ) {
    super();
    this.root = resolve(
      config.get<string>('FILES_STORAGE_PATH') ?? './.data/files',
    );
  }
  private readonly root: string;
  async process(job: Job<FileDerivativesJobData>) {
    if (job.name !== FILE_DERIVATIVES_JOB) return;
    const [asset] = await this.database.db
      .select()
      .from(fileAssets)
      .where(eq(fileAssets.id, job.data.assetId))
      .limit(1);
    if (
      !asset ||
      asset.status !== 'ready' ||
      (!asset.mimeType.startsWith('image/') &&
        !asset.mimeType.startsWith('video/'))
    )
      return;
    const source = resolve(this.root, asset.storageKey);
    const key = thumbnailStorageKey(asset.workspaceId, asset.id);
    const target = resolve(this.root, key);
    const temporary = resolve(
      this.root,
      `${temporaryStorageKey(crypto.randomUUID())}.webp`,
    );
    try {
      await mkdir(resolve(temporary, '..'), { recursive: true });
      await mkdir(resolve(target, '..'), { recursive: true });
      const metadata = asset.mimeType.startsWith('image/')
        ? await sharp(source)
            .rotate()
            .resize({
              width: 640,
              height: 480,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: 82 })
            .toFile(temporary)
        : await this.videoThumbnail(source, temporary);
      await rename(temporary, target);
      await this.database.db
        .update(fileAssets)
        .set({
          width: metadata.width ?? null,
          height: metadata.height ?? null,
          thumbnailKey: key,
          thumbnailStatus: 'ready',
          thumbnailErrorCode: null,
          updatedAt: new Date(),
        })
        .where(eq(fileAssets.id, asset.id));
      await this.audit.write({
        workspaceId: asset.workspaceId,
        actorUserId: asset.createdByUserId,
        event: 'files.thumbnail_generated',
        severity: 'success',
        outcome: 'succeeded',
        queueName: FILE_DERIVATIVES_QUEUE,
        jobId: job.id,
        attempt: job.attemptsMade,
        summary: `Thumbnail generated for ${asset.mimeType}`,
        metadata: { fileAssetId: asset.id },
      });
    } catch {
      await rm(temporary, { force: true });
      await this.database.db
        .update(fileAssets)
        .set({
          thumbnailStatus: 'failed',
          thumbnailErrorCode: 'THUMBNAIL_GENERATION_FAILED',
          updatedAt: new Date(),
        })
        .where(eq(fileAssets.id, asset.id));
      await this.audit.write({
        workspaceId: asset.workspaceId,
        actorUserId: asset.createdByUserId,
        event: 'files.thumbnail_generated',
        severity: 'error',
        outcome: 'failed',
        queueName: FILE_DERIVATIVES_QUEUE,
        jobId: job.id,
        attempt: job.attemptsMade,
        errorCode: 'THUMBNAIL_GENERATION_FAILED',
        summary: 'Thumbnail generation failed',
        metadata: { fileAssetId: asset.id },
      });
    }
  }
  private async videoThumbnail(source: string, target: string) {
    await promisify(execFile)('ffmpeg', [
      '-y',
      '-ss',
      '00:00:01',
      '-i',
      source,
      '-frames:v',
      '1',
      '-vf',
      'scale=640:-2',
      target,
    ]);
    const metadata = await sharp(target).metadata();
    return { width: metadata.width, height: metadata.height };
  }
}
