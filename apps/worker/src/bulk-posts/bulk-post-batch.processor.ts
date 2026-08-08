import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  bulkPostBatches,
  bulkPostBatchTargets,
  bulkPostRowPosts,
  bulkPostRows,
  fileAssets,
  publishingPostMedia,
  publishingPosts,
} from '@workspace/database';
import { and, eq, inArray } from '@workspace/database/query';
import type { Job } from 'bullmq';
import { WorkerAuditService } from '../audit/worker-audit.service';
import { AutomationWebhookEventsService } from '../automation/automation-webhook-events.service';
import { DatabaseService } from '../database/database.service';
import {
  BULK_POST_BATCH_JOB,
  BULK_POST_BATCH_QUEUE,
  type BulkPostBatchJobData,
} from './bulk-posts.constants';

const maximumRows = 5_000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
@Processor(BULK_POST_BATCH_QUEUE, { concurrency: 1 })
export class BulkPostBatchProcessor extends WorkerHost {
  private readonly storageRoot: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly audit: WorkerAuditService,
    private readonly events: AutomationWebhookEventsService,
    config: ConfigService,
  ) {
    super();
    this.storageRoot = resolve(
      config.get<string>('FILES_STORAGE_PATH') ?? './.data/files',
    );
  }

  async process(job: Job<BulkPostBatchJobData>) {
    if (job.name !== BULK_POST_BATCH_JOB) return;
    const [record] = await this.database.db
      .select({ batch: bulkPostBatches, file: fileAssets })
      .from(bulkPostBatches)
      .innerJoin(
        fileAssets,
        eq(bulkPostBatches.sourceFileAssetId, fileAssets.id),
      )
      .where(
        and(
          eq(bulkPostBatches.id, job.data.batchId),
          eq(bulkPostBatches.workspaceId, job.data.workspaceId),
        ),
      )
      .limit(1);
    if (!record || ['completed', 'cancelled'].includes(record.batch.status)) {
      return;
    }
    const now = new Date();
    await this.database.db
      .update(bulkPostBatches)
      .set({
        status: 'processing',
        startedAt: record.batch.startedAt ?? now,
        errorCode: null,
        updatedAt: now,
      })
      .where(eq(bulkPostBatches.id, record.batch.id));

    try {
      const sourcePath = resolve(this.storageRoot, record.file.storageKey);
      const raw = await readFile(sourcePath, 'utf8');
      const parsedRows = parseCsv(raw);
      if (!parsedRows.length || parsedRows.length > maximumRows) {
        throw new BulkPostError('BULK_POST_ROW_COUNT_INVALID');
      }
      await this.ensureRows(
        record.batch.id,
        record.batch.workspaceId,
        parsedRows,
      );
      const targets = await this.database.db
        .select()
        .from(bulkPostBatchTargets)
        .where(eq(bulkPostBatchTargets.batchId, record.batch.id));
      if (!targets.length) throw new BulkPostError('BULK_POST_TARGETS_MISSING');
      const rows = await this.database.db
        .select()
        .from(bulkPostRows)
        .where(eq(bulkPostRows.batchId, record.batch.id))
        .orderBy(bulkPostRows.rowNumber);
      let scheduledOrdinal = 0;
      for (const row of rows) {
        const [freshBatch] = await this.database.db
          .select({ status: bulkPostBatches.status })
          .from(bulkPostBatches)
          .where(eq(bulkPostBatches.id, record.batch.id))
          .limit(1);
        if (!freshBatch || freshBatch.status === 'cancelled') return;
        if (row.status === 'processed' || row.status === 'invalid') continue;
        const validationErrors = validateRow(row.payload);
        if (validationErrors.length) {
          await this.database.db
            .update(bulkPostRows)
            .set({
              status: 'invalid',
              validationErrors,
              processedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(bulkPostRows.id, row.id));
          continue;
        }
        const mediaIds = parseMediaIds(row.payload.file_asset_ids ?? '');
        const media = mediaIds.length
          ? await this.database.db
              .select({ id: fileAssets.id })
              .from(fileAssets)
              .where(
                and(
                  eq(fileAssets.workspaceId, record.batch.workspaceId),
                  eq(fileAssets.status, 'ready'),
                  inArray(fileAssets.id, mediaIds),
                ),
              )
          : [];
        if (media.length !== mediaIds.length) {
          await this.database.db
            .update(bulkPostRows)
            .set({
              status: 'invalid',
              validationErrors: ['BULK_POST_MEDIA_NOT_AVAILABLE'],
              processedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(bulkPostRows.id, row.id));
          continue;
        }
        const scheduledAt = resolveSchedule(
          row.payload.scheduled_at,
          record.batch.intervalMinutes,
          scheduledOrdinal++,
        );
        let failed = false;
        for (const target of targets) {
          try {
            await this.createPostIfMissing({
              actorUserId: record.batch.createdByUserId,
              content: row.payload.content ?? row.payload.caption ?? '',
              mediaIds,
              mode: row.payload.mode,
              rowId: row.id,
              scheduledAt,
              socialAccountId: target.socialAccountId,
              workspaceId: record.batch.workspaceId,
            });
          } catch {
            failed = true;
          }
        }
        await this.database.db
          .update(bulkPostRows)
          .set({
            status: failed ? 'failed' : 'processed',
            validationErrors: failed ? ['BULK_POST_POST_CREATE_FAILED'] : [],
            processedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bulkPostRows.id, row.id));
      }
      await this.finish(record.batch.id, false);
      await this.audit.write({
        workspaceId: record.batch.workspaceId,
        actorUserId: record.batch.createdByUserId,
        event: 'bulk_posts.batch_processed',
        severity: 'success',
        outcome: 'succeeded',
        queueName: BULK_POST_BATCH_QUEUE,
        jobId: String(job.id ?? ''),
        attempt: job.attemptsMade,
        metadata: { batchId: record.batch.id },
      });
    } catch (error) {
      const errorCode =
        error instanceof BulkPostError
          ? error.code
          : 'BULK_POST_PROCESSING_FAILED';
      await this.database.db
        .update(bulkPostBatches)
        .set({
          status: 'failed',
          errorCode,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bulkPostBatches.id, record.batch.id));
      await this.audit.write({
        workspaceId: record.batch.workspaceId,
        actorUserId: record.batch.createdByUserId,
        event: 'bulk_posts.batch_processed',
        severity: 'error',
        outcome: 'failed',
        queueName: BULK_POST_BATCH_QUEUE,
        jobId: String(job.id ?? ''),
        attempt: job.attemptsMade,
        errorCode,
        metadata: { batchId: record.batch.id },
      });
      throw error;
    }
  }

  private async ensureRows(
    batchId: string,
    workspaceId: string,
    rows: Record<string, string>[],
  ) {
    const now = new Date();
    await this.database.db
      .insert(bulkPostRows)
      .values(
        rows.map((payload, index) => ({
          batchId,
          workspaceId,
          rowNumber: index + 2,
          payload,
          status: 'pending' as const,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing();
  }

  private async createPostIfMissing(input: {
    actorUserId: string;
    content: string;
    mediaIds: string[];
    mode?: string;
    rowId: string;
    scheduledAt: Date;
    socialAccountId: string;
    workspaceId: string;
  }) {
    const [existing] = await this.database.db
      .select({ id: bulkPostRowPosts.id })
      .from(bulkPostRowPosts)
      .where(
        and(
          eq(bulkPostRowPosts.bulkPostRowId, input.rowId),
          eq(bulkPostRowPosts.socialAccountId, input.socialAccountId),
        ),
      )
      .limit(1);
    if (existing) return;
    const createdPostId = await this.database.db.transaction(async (tx) => {
      const mode = input.mode?.trim().toLowerCase();
      const [post] = await tx
        .insert(publishingPosts)
        .values({
          workspaceId: input.workspaceId,
          authorUserId: input.actorUserId,
          socialAccountId: input.socialAccountId,
          status: mode === 'draft' ? 'draft' : 'scheduled',
          content: input.content,
          scheduledAt: mode === 'draft' ? null : input.scheduledAt,
        })
        .returning({ id: publishingPosts.id });
      if (!post) throw new Error('Publishing post was not created.');
      if (input.mediaIds.length) {
        await tx.insert(publishingPostMedia).values(
          input.mediaIds.map((fileAssetId, position) => ({
            publishingPostId: post.id,
            fileAssetId,
            workspaceId: input.workspaceId,
            position,
          })),
        );
      }
      await tx.insert(bulkPostRowPosts).values({
        bulkPostRowId: input.rowId,
        publishingPostId: post.id,
        socialAccountId: input.socialAccountId,
      });
      return post.id;
    });
    await this.events.emit({
      workspaceId: input.workspaceId,
      event: 'post.created',
      subjectId: createdPostId,
      payload: { postId: createdPostId, source: 'bulk-posts' },
    });
  }

  private async finish(batchId: string, failed: boolean) {
    const [rows, posts] = await Promise.all([
      this.database.db
        .select({ status: bulkPostRows.status })
        .from(bulkPostRows)
        .where(eq(bulkPostRows.batchId, batchId)),
      this.database.db
        .select({ id: bulkPostRowPosts.id })
        .from(bulkPostRowPosts)
        .innerJoin(
          bulkPostRows,
          eq(bulkPostRowPosts.bulkPostRowId, bulkPostRows.id),
        )
        .where(eq(bulkPostRows.batchId, batchId)),
    ]);
    await this.database.db
      .update(bulkPostBatches)
      .set({
        status: failed ? 'failed' : 'completed',
        totalRows: rows.length,
        validRows: rows.filter((row) => row.status === 'processed').length,
        invalidRows: rows.filter((row) => row.status === 'invalid').length,
        failedRows: rows.filter((row) => row.status === 'failed').length,
        createdPosts: posts.length,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bulkPostBatches.id, batchId));
  }
}

class BulkPostError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function validateRow(row: Record<string, string>) {
  const errors: string[] = [];
  const content = (row.content ?? row.caption ?? '').trim();
  const mediaTokens = splitMediaIds(row.file_asset_ids ?? '');
  const mediaIds = parseMediaIds(row.file_asset_ids ?? '');
  if (!content && !mediaIds.length) errors.push('BULK_POST_CONTENT_REQUIRED');
  if (content.length > 10_000) errors.push('BULK_POST_CONTENT_TOO_LONG');
  if (mediaIds.length > 20) errors.push('BULK_POST_TOO_MANY_MEDIA');
  if (mediaTokens.length !== mediaIds.length) {
    errors.push('BULK_POST_MEDIA_ID_INVALID');
  }
  if (row.scheduled_at && Number.isNaN(Date.parse(row.scheduled_at))) {
    errors.push('BULK_POST_SCHEDULE_INVALID');
  }
  if (row.mode && !['draft', 'scheduled'].includes(row.mode.toLowerCase())) {
    errors.push('BULK_POST_MODE_INVALID');
  }
  return errors;
}

function parseMediaIds(value: string) {
  return splitMediaIds(value).filter((id) => uuidPattern.test(id));
}

function splitMediaIds(value: string) {
  return [
    ...new Set(
      value
        .split(/[;,\s]+/)
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

function resolveSchedule(
  value: string | undefined,
  intervalMinutes: number,
  ordinal: number,
) {
  if (value) return new Date(value);
  return new Date(Date.now() + intervalMinutes * ordinal * 60_000);
}

function parseCsv(input: string): Record<string, string>[] {
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === ',' && !quoted) {
      row.push(field);
      field = '';
      continue;
    }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) matrix.push(row);
      row = [];
      field = '';
      continue;
    }
    field += character;
  }
  row.push(field);
  if (row.some((value) => value.trim() !== '')) matrix.push(row);
  if (quoted || matrix.length < 2) return [];
  const headers = matrix[0].map((header) =>
    header.trim().toLowerCase().replace(/\s+/g, '_'),
  );
  if (new Set(headers).size !== headers.length) return [];
  return matrix
    .slice(1)
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, (values[index] ?? '').trim()]),
      ),
    );
}
