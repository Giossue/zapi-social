import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  fileAssets,
  fileImportBatches,
  fileImportItems,
} from '@workspace/database';
import { and, eq, inArray, sql } from '@workspace/database/query';
import {
  allowedMime,
  detectFileMime,
  matchesFileSignature,
  MAX_FILE_BYTES,
  originalStorageKey,
  temporaryStorageKey,
} from '@workspace/file-ingestion';
import type { Job, Queue } from 'bullmq';
import { createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { WorkerAuditService } from '../audit/worker-audit.service';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import {
  FILE_DERIVATIVES_JOB,
  FILE_DERIVATIVES_QUEUE,
} from './file-derivatives.constants';
import {
  FILE_IMPORTS_QUEUE,
  GOOGLE_DRIVE_IMPORT_JOB,
  type FileImportJobData,
} from './file-imports.constants';

type ImportItem = typeof fileImportItems.$inferSelect;

export class DriveImportError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

export function googleDriveFailureForStatus(status: number) {
  if (status === 401)
    return new DriveImportError('GOOGLE_DRIVE_IMPORT_EXPIRED', false);
  if (status === 403)
    return new DriveImportError('GOOGLE_DRIVE_PERMISSION_DENIED', false);
  if (status === 404)
    return new DriveImportError('GOOGLE_DRIVE_FILE_NOT_FOUND', false);
  if (status === 429 || status >= 500)
    return new DriveImportError('GOOGLE_DRIVE_IMPORT_FAILED', true);
  return new DriveImportError('GOOGLE_DRIVE_IMPORT_FAILED', false);
}

export function nextDriveByteCount(
  receivedBytes: number,
  chunkBytes: number,
  declaredBytes: number,
) {
  const next = receivedBytes + chunkBytes;
  if (next > MAX_FILE_BYTES || next > declaredBytes) {
    throw new DriveImportError('GOOGLE_DRIVE_FILE_TOO_LARGE', false);
  }
  return next;
}

@Injectable()
@Processor(FILE_IMPORTS_QUEUE, { concurrency: 2 })
export class GoogleDriveImportProcessor extends WorkerHost {
  private readonly root: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
    private readonly audit: WorkerAuditService,
    @InjectQueue(FILE_DERIVATIVES_QUEUE)
    private readonly derivatives: Queue,
    config: ConfigService,
  ) {
    super();
    this.root = resolve(
      config.get<string>('FILES_STORAGE_PATH') ?? './.data/files',
    );
  }

  async process(job: Job<FileImportJobData>) {
    if (job.name !== GOOGLE_DRIVE_IMPORT_JOB) return;
    let stage = 'load_batch';
    try {
      const [batch] = await this.database.db
        .select()
        .from(fileImportBatches)
        .where(eq(fileImportBatches.id, job.data.batchId))
        .limit(1);
      if (!batch || this.isTerminal(batch.status)) return;
      if (
        batch.credentialExpiresAt.valueOf() <= Date.now() ||
        !batch.encryptedAccessToken
      ) {
        await this.expireBatch(batch.id);
        return;
      }

      stage = 'decrypt_access_token';
      const accessToken = this.encryption.decrypt(
        batch.encryptedAccessToken,
        `google-drive-import:${batch.id}`,
      );
      stage = 'mark_processing';
      await this.database.db
        .update(fileImportBatches)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(fileImportBatches.id, batch.id));

      await this.audit
        .write({
          workspaceId: batch.workspaceId,
          actorUserId: batch.requestedByUserId,
          event: 'files.google_drive_import_started',
          severity: 'success',
          outcome: 'started',
          queueName: FILE_IMPORTS_QUEUE,
          jobId: job.id ? String(job.id) : null,
          attempt: job.attemptsMade + 1,
          summary: 'Google Drive import started.',
          metadata: { importBatchId: batch.id },
        })
        .catch(() => undefined);

      stage = 'load_items';
      const items = await this.database.db
        .select()
        .from(fileImportItems)
        .where(
          and(
            eq(fileImportItems.batchId, batch.id),
            inArray(fileImportItems.status, ['pending', 'processing']),
          ),
        );
      let retryableFailure = false;
      stage = 'import_items';
      for (const item of items) {
        try {
          await this.importItem(batch, item, accessToken);
        } catch (error) {
          const failure =
            error instanceof DriveImportError
              ? error
              : new DriveImportError('GOOGLE_DRIVE_IMPORT_FAILED', true);
          const canRetry = failure.retryable && job.attemptsMade < 2;
          retryableFailure ||= canRetry;
          await this.failItem(item, failure.code, canRetry);
        }
        await this.refreshBatch(batch.id);
      }

      await this.refreshBatch(batch.id);
      if (retryableFailure) {
        stage = 'retry_items';
        throw new Error('Retryable Google Drive import.');
      }
    } catch (error) {
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await this.recordProcessFailure(job, stage, finalAttempt).catch(
        () => undefined,
      );
      if (finalAttempt) {
        await this.failRemainingItems(job.data.batchId).catch(() => undefined);
        return;
      }
      throw error;
    }
  }

  private async recordProcessFailure(
    job: Job<FileImportJobData>,
    stage: string,
    finalAttempt: boolean,
  ) {
    const [batch] = await this.database.db
      .select({
        workspaceId: fileImportBatches.workspaceId,
        requestedByUserId: fileImportBatches.requestedByUserId,
      })
      .from(fileImportBatches)
      .where(eq(fileImportBatches.id, job.data.batchId))
      .limit(1);
    await this.audit.write({
      workspaceId: batch?.workspaceId,
      actorUserId: batch?.requestedByUserId,
      event: 'files.google_drive_import_failed',
      severity: finalAttempt ? 'error' : 'warning',
      outcome: finalAttempt ? 'failed' : 'retrying',
      queueName: FILE_IMPORTS_QUEUE,
      jobId: job.id ? String(job.id) : null,
      attempt: job.attemptsMade + 1,
      errorCode: 'GOOGLE_DRIVE_IMPORT_FAILED',
      summary: finalAttempt
        ? 'Google Drive import stopped after all retries.'
        : 'Google Drive import will retry.',
      metadata: {
        importBatchId: job.data.batchId,
        stage,
        finalAttempt,
      },
    });
  }

  private async failRemainingItems(batchId: string) {
    await this.database.db
      .update(fileImportItems)
      .set({
        status: 'failed',
        errorCode: sql`coalesce(${fileImportItems.errorCode}, 'GOOGLE_DRIVE_IMPORT_FAILED')`,
        providerFileIdCiphertext: null,
        resourceKeyCiphertext: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fileImportItems.batchId, batchId),
          sql`${fileImportItems.status} <> 'completed'`,
        ),
      );
    await this.refreshBatch(batchId);
  }

  private async importItem(
    batch: typeof fileImportBatches.$inferSelect,
    item: ImportItem,
    accessToken: string,
  ) {
    if (!item.providerFileIdCiphertext) {
      throw new DriveImportError('GOOGLE_DRIVE_FILE_NOT_FOUND', false);
    }
    const providerFileId = this.encryption.decrypt(
      item.providerFileIdCiphertext,
      `google-drive-file:${batch.id}:${item.providerFileIdHash}`,
    );
    const resourceKey = item.resourceKeyCiphertext
      ? this.encryption.decrypt(
          item.resourceKeyCiphertext,
          `google-drive-resource:${batch.id}:${item.providerFileIdHash}`,
        )
      : undefined;

    const metadata = await this.metadata(
      providerFileId,
      accessToken,
      resourceKey,
    );
    const sizeBytes = Number(metadata.size);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
      throw new DriveImportError('GOOGLE_DRIVE_UNSUPPORTED_FILE', false);
    }
    if (sizeBytes > MAX_FILE_BYTES) {
      throw new DriveImportError('GOOGLE_DRIVE_FILE_TOO_LARGE', false);
    }
    if (
      !metadata.mimeType.startsWith('image/') &&
      !metadata.mimeType.startsWith('video/')
    ) {
      throw new DriveImportError('GOOGLE_DRIVE_UNSUPPORTED_FILE', false);
    }

    const name = basename(metadata.name).slice(0, 255);
    const extension = this.extension(name, metadata.mimeType);
    const mimeType = allowedMime(extension, metadata.mimeType);
    if (!name || !mimeType) {
      throw new DriveImportError('GOOGLE_DRIVE_UNSUPPORTED_FILE', false);
    }

    const asset = await this.claimAsset(batch, item, {
      name,
      extension,
      mimeType,
      sizeBytes,
    });
    if (asset.status === 'ready') {
      await this.completeItem(item.id, asset.id, batch.workspaceId);
      return;
    }

    const target = this.path(asset.storageKey);
    const temporary = this.path(temporaryStorageKey(crypto.randomUUID()));
    try {
      await mkdir(resolve(temporary, '..'), { recursive: true });
      await mkdir(resolve(target, '..'), { recursive: true });
      const response = await this.driveFetch(
        providerFileId,
        accessToken,
        resourceKey,
        true,
      );
      if (!response.body) {
        throw new DriveImportError('GOOGLE_DRIVE_IMPORT_FAILED', true);
      }
      let receivedBytes = 0;
      const guard = new Transform({
        transform: (chunk: Buffer, _encoding, callback) => {
          try {
            receivedBytes = nextDriveByteCount(
              receivedBytes,
              chunk.length,
              sizeBytes,
            );
            callback(null, chunk);
          } catch (error) {
            callback(error as Error);
          }
        },
      });
      await pipeline(
        Readable.fromWeb(response.body as never),
        guard,
        createWriteStream(temporary, { flags: 'wx' }),
      );
      if (receivedBytes !== sizeBytes) {
        throw new DriveImportError('GOOGLE_DRIVE_IMPORT_FAILED', true);
      }
      await this.assertBinary(extension, mimeType, temporary);
      await rm(target, { force: true });
      await rename(temporary, target);
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(fileAssets)
          .set({ status: 'ready', updatedAt: new Date() })
          .where(
            and(
              eq(fileAssets.id, asset.id),
              eq(fileAssets.workspaceId, batch.workspaceId),
              eq(fileAssets.status, 'pending'),
            ),
          );
        await tx
          .update(fileImportItems)
          .set({
            status: 'completed',
            fileAssetId: asset.id,
            fileAssetWorkspaceId: batch.workspaceId,
            providerFileIdCiphertext: null,
            resourceKeyCiphertext: null,
            errorCode: null,
            updatedAt: new Date(),
          })
          .where(eq(fileImportItems.id, item.id));
      });
      await this.queueThumbnail(asset.id);
      await this.audit.write({
        workspaceId: batch.workspaceId,
        actorUserId: batch.requestedByUserId,
        event: 'files.google_drive_imported',
        severity: 'success',
        outcome: 'succeeded',
        queueName: FILE_IMPORTS_QUEUE,
        summary: `Google Drive ${mimeType.startsWith('image/') ? 'image' : 'video'} imported`,
        metadata: { fileAssetId: asset.id, importBatchId: batch.id },
      });
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  private async claimAsset(
    batch: typeof fileImportBatches.$inferSelect,
    item: ImportItem,
    metadata: {
      name: string;
      extension: string;
      mimeType: string;
      sizeBytes: number;
    },
  ) {
    if (item.fileAssetId) {
      const [existing] = await this.database.db
        .select()
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.id, item.fileAssetId),
            eq(fileAssets.workspaceId, batch.workspaceId),
          ),
        )
        .limit(1);
      if (existing) {
        await this.database.db
          .update(fileImportItems)
          .set({
            status: 'processing',
            attemptCount: sql`${fileImportItems.attemptCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(fileImportItems.id, item.id));
        return existing;
      }
    }

    const assetId = crypto.randomUUID();
    const storageKey = originalStorageKey({
      workspaceId: batch.workspaceId,
      assetId,
      extension: metadata.name,
    });
    const [asset] = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(fileAssets)
        .values({
          id: assetId,
          workspaceId: batch.workspaceId,
          folderId: batch.destinationFolderId,
          createdByUserId: batch.requestedByUserId,
          storageKey,
          ...metadata,
          thumbnailStatus: 'pending',
          metadata: { source: 'google_drive', importBatchId: batch.id },
        })
        .returning();
      if (!created)
        throw new DriveImportError('GOOGLE_DRIVE_IMPORT_FAILED', true);
      await tx
        .update(fileImportItems)
        .set({
          status: 'processing',
          fileAssetId: created.id,
          fileAssetWorkspaceId: batch.workspaceId,
          attemptCount: sql`${fileImportItems.attemptCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(fileImportItems.id, item.id));
      return [created];
    });
    if (!asset) throw new DriveImportError('GOOGLE_DRIVE_IMPORT_FAILED', true);
    return asset;
  }

  private async metadata(
    providerFileId: string,
    accessToken: string,
    resourceKey?: string,
  ) {
    const response = await this.driveFetch(
      providerFileId,
      accessToken,
      resourceKey,
      false,
    );
    const body = (await response.json()) as {
      id?: unknown;
      name?: unknown;
      mimeType?: unknown;
      size?: unknown;
    };
    if (
      body.id !== providerFileId ||
      typeof body.name !== 'string' ||
      typeof body.mimeType !== 'string' ||
      typeof body.size !== 'string'
    ) {
      throw new DriveImportError('GOOGLE_DRIVE_IMPORT_FAILED', false);
    }
    return {
      name: body.name,
      mimeType: body.mimeType,
      size: body.size,
    };
  }

  private async driveFetch(
    providerFileId: string,
    accessToken: string,
    resourceKey: string | undefined,
    media: boolean,
  ) {
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(providerFileId)}`,
    );
    url.searchParams.set('supportsAllDrives', 'true');
    if (media) url.searchParams.set('alt', 'media');
    else url.searchParams.set('fields', 'id,name,mimeType,size');
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(resourceKey
            ? {
                'x-goog-drive-resource-keys': `${providerFileId}/${resourceKey}`,
              }
            : {}),
        },
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new DriveImportError('GOOGLE_DRIVE_IMPORT_FAILED', true);
    }
    if (response.ok) return response;
    throw googleDriveFailureForStatus(response.status);
  }

  private async assertBinary(
    extension: string,
    mimeType: string,
    path: string,
  ) {
    const handle = await open(path, 'r');
    try {
      const buffer = Buffer.alloc(4096);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const detected = detectFileMime(buffer.subarray(0, bytesRead));
      if (!detected || !matchesFileSignature(extension, mimeType, detected)) {
        throw new DriveImportError('GOOGLE_DRIVE_UNSUPPORTED_FILE', false);
      }
    } finally {
      await handle.close();
    }
  }

  private extension(name: string, mimeType: string) {
    const fromName = extname(name).slice(1).toLowerCase();
    if (allowedMime(fromName, mimeType)) return fromName;
    const fallback: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
    };
    return fallback[mimeType] ?? fromName;
  }

  private async failItem(item: ImportItem, code: string, retry: boolean) {
    const [current] = await this.database.db
      .select()
      .from(fileImportItems)
      .where(eq(fileImportItems.id, item.id))
      .limit(1);
    if (current?.fileAssetId) {
      const [asset] = await this.database.db
        .select()
        .from(fileAssets)
        .where(eq(fileAssets.id, current.fileAssetId))
        .limit(1);
      if (asset?.status === 'pending') {
        await Promise.all([
          rm(this.path(asset.storageKey), { force: true }),
          this.database.db
            .delete(fileAssets)
            .where(eq(fileAssets.id, asset.id)),
        ]);
      }
    }
    await this.database.db
      .update(fileImportItems)
      .set({
        status: retry ? 'pending' : 'failed',
        fileAssetId: null,
        fileAssetWorkspaceId: null,
        errorCode: code,
        providerFileIdCiphertext: retry
          ? current?.providerFileIdCiphertext
          : null,
        resourceKeyCiphertext: retry ? current?.resourceKeyCiphertext : null,
        updatedAt: new Date(),
      })
      .where(eq(fileImportItems.id, item.id));
  }

  private async completeItem(
    itemId: string,
    fileAssetId: string,
    workspaceId: string,
  ) {
    await this.database.db
      .update(fileImportItems)
      .set({
        status: 'completed',
        fileAssetId,
        fileAssetWorkspaceId: workspaceId,
        providerFileIdCiphertext: null,
        resourceKeyCiphertext: null,
        errorCode: null,
        updatedAt: new Date(),
      })
      .where(eq(fileImportItems.id, itemId));
  }

  private async refreshBatch(batchId: string) {
    const items = await this.database.db
      .select({ status: fileImportItems.status })
      .from(fileImportItems)
      .where(eq(fileImportItems.batchId, batchId));
    const completed = items.filter(
      (item) => item.status === 'completed',
    ).length;
    const failed = items.filter((item) => item.status === 'failed').length;
    const terminal = completed + failed === items.length;
    const status = terminal
      ? completed === items.length
        ? 'completed'
        : failed === items.length
          ? 'failed'
          : 'partial'
      : 'processing';
    await this.database.db
      .update(fileImportBatches)
      .set({
        status,
        completedItems: completed,
        failedItems: failed,
        encryptedAccessToken: terminal ? null : undefined,
        updatedAt: new Date(),
      })
      .where(eq(fileImportBatches.id, batchId));
  }

  private async expireBatch(batchId: string) {
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(fileImportItems)
        .set({
          status: 'failed',
          errorCode: 'GOOGLE_DRIVE_IMPORT_EXPIRED',
          providerFileIdCiphertext: null,
          resourceKeyCiphertext: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(fileImportItems.batchId, batchId),
            sql`${fileImportItems.status} <> 'completed'`,
          ),
        );
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(fileImportItems)
        .where(
          and(
            eq(fileImportItems.batchId, batchId),
            eq(fileImportItems.status, 'failed'),
          ),
        );
      await tx
        .update(fileImportBatches)
        .set({
          status: 'expired',
          failedItems: count ?? 0,
          encryptedAccessToken: null,
          updatedAt: new Date(),
        })
        .where(eq(fileImportBatches.id, batchId));
    });
  }

  private async queueThumbnail(assetId: string) {
    try {
      await this.derivatives.add(
        FILE_DERIVATIVES_JOB,
        { assetId },
        {
          jobId: `thumbnail-${assetId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch {}
  }

  private path(storageKey: string) {
    const path = resolve(this.root, storageKey);
    if (!path.startsWith(`${this.root}/`)) {
      throw new DriveImportError('GOOGLE_DRIVE_IMPORT_FAILED', false);
    }
    return path;
  }

  private isTerminal(status: string) {
    return ['completed', 'partial', 'failed', 'expired'].includes(status);
  }
}
