import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  bulkPostBatches,
  bulkPostBatchTargets,
  bulkPostRowPosts,
  bulkPostRows,
  fileAssets,
  socialAccounts,
} from '@workspace/database';
import { and, count, desc, eq, inArray } from '@workspace/database/query';
import {
  createPortalBulkPostBatchSchema,
  portalBulkPostBatchesQuerySchema,
  portalBulkPostRowsQuerySchema,
  type PortalAuthSession,
  type PortalBulkPostBatch,
  type PortalBulkPostBatchDetail,
  type PortalBulkPostBatchesResponse,
} from '@workspace/contracts';
import type { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import {
  BULK_POST_BATCH_JOB,
  BULK_POST_BATCH_QUEUE,
  type BulkPostBatchJobData,
} from './bulk-posts.constants';

const managerRoles = new Set(['owner', 'admin']);
const maximumCsvBytes = 10 * 1024 * 1024;

@Injectable()
export class BulkPostsService {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue(BULK_POST_BATCH_QUEUE)
    private readonly queue: Queue<BulkPostBatchJobData>,
  ) {}

  async list(
    session: PortalAuthSession,
    query: unknown,
  ): Promise<PortalBulkPostBatchesResponse> {
    const parsed = portalBulkPostBatchesQuerySchema.safeParse(query);
    if (!parsed.success) throw this.invalid();
    const conditions = [eq(bulkPostBatches.workspaceId, session.workspace.id)];
    if (parsed.data.status) {
      conditions.push(eq(bulkPostBatches.status, parsed.data.status));
    }
    const where = and(...conditions)!;
    const offset = (parsed.data.page - 1) * parsed.data.limit;
    const [rows, totals] = await Promise.all([
      this.database.db
        .select({ batch: bulkPostBatches, file: fileAssets })
        .from(bulkPostBatches)
        .innerJoin(
          fileAssets,
          eq(bulkPostBatches.sourceFileAssetId, fileAssets.id),
        )
        .where(where)
        .orderBy(desc(bulkPostBatches.createdAt), desc(bulkPostBatches.id))
        .limit(parsed.data.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(bulkPostBatches)
        .where(where),
    ]);
    const targetIds = await this.targetsByBatch(
      rows.map(({ batch }) => batch.id),
    );
    return {
      batches: rows.map(({ batch, file }) =>
        this.serialize(batch, file.name, targetIds.get(batch.id) ?? []),
      ),
      page: parsed.data.page,
      limit: parsed.data.limit,
      total: Number(totals[0]?.total ?? 0),
    };
  }

  async get(
    session: PortalAuthSession,
    id: string,
    query: unknown,
  ): Promise<PortalBulkPostBatchDetail> {
    const batchId = this.parseId(id);
    const parsed = portalBulkPostRowsQuerySchema.safeParse(query);
    if (!parsed.success) throw this.invalid();
    const { batch, fileName } = await this.find(session.workspace.id, batchId);
    const rowConditions = [eq(bulkPostRows.batchId, batchId)];
    if (parsed.data.status) {
      rowConditions.push(eq(bulkPostRows.status, parsed.data.status));
    }
    const where = and(...rowConditions)!;
    const offset = (parsed.data.page - 1) * parsed.data.limit;
    const [rows, totals, targetMap] = await Promise.all([
      this.database.db
        .select()
        .from(bulkPostRows)
        .where(where)
        .orderBy(bulkPostRows.rowNumber)
        .limit(parsed.data.limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(bulkPostRows)
        .where(where),
      this.targetsByBatch([batchId]),
    ]);
    const rowIds = rows.map((row) => row.id);
    const postRows = rowIds.length
      ? await this.database.db
          .select()
          .from(bulkPostRowPosts)
          .where(inArray(bulkPostRowPosts.bulkPostRowId, rowIds))
      : [];
    const postsByRow = new Map<string, string[]>();
    for (const post of postRows) {
      const ids = postsByRow.get(post.bulkPostRowId) ?? [];
      ids.push(post.publishingPostId);
      postsByRow.set(post.bulkPostRowId, ids);
    }
    return {
      batch: this.serialize(batch, fileName, targetMap.get(batchId) ?? []),
      rows: rows.map((row) => ({
        id: row.id,
        rowNumber: row.rowNumber,
        status: row.status,
        payload: row.payload,
        validationErrors: row.validationErrors,
        publishingPostIds: postsByRow.get(row.id) ?? [],
        processedAt: row.processedAt?.toISOString() ?? null,
      })),
      page: parsed.data.page,
      limit: parsed.data.limit,
      total: Number(totals[0]?.total ?? 0),
    };
  }

  async create(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalBulkPostBatch> {
    this.requireManage(session);
    const parsed = createPortalBulkPostBatchSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const [file] = await this.database.db
      .select()
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.id, parsed.data.sourceFileAssetId),
          eq(fileAssets.workspaceId, session.workspace.id),
          eq(fileAssets.status, 'ready'),
        ),
      )
      .limit(1);
    if (
      !file ||
      !['csv', 'txt'].includes(file.extension ?? '') ||
      file.sizeBytes > maximumCsvBytes
    ) {
      throw new AppException(
        'BULK_POST_SOURCE_FILE_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const accounts = await this.database.db
      .select({ id: socialAccounts.id })
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, session.workspace.id),
          eq(socialAccounts.status, 'active'),
          inArray(socialAccounts.id, parsed.data.targetSocialAccountIds),
        ),
      );
    if (accounts.length !== parsed.data.targetSocialAccountIds.length) {
      throw new AppException(
        'BULK_POST_TARGET_NOT_AVAILABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const now = new Date();
    const batch = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(bulkPostBatches)
        .values({
          workspaceId: session.workspace.id,
          createdByUserId: session.user.id,
          sourceFileAssetId: file.id,
          intervalMinutes: parsed.data.intervalMinutes,
          timezone: parsed.data.timezone,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw this.failed();
      await tx.insert(bulkPostBatchTargets).values(
        parsed.data.targetSocialAccountIds.map((socialAccountId) => ({
          batchId: created.id,
          workspaceId: session.workspace.id,
          socialAccountId,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'bulk_posts.batch_created',
        subjectType: 'bulk_post_batch',
        subjectId: created.id,
        metadata: { targetCount: parsed.data.targetSocialAccountIds.length },
      });
      return created;
    });
    const jobId = `bulk-${batch.id}`;
    try {
      await this.queue.add(
        BULK_POST_BATCH_JOB,
        { batchId: batch.id, workspaceId: session.workspace.id },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 500,
          removeOnFail: 1_000,
        },
      );
      await this.database.db
        .update(bulkPostBatches)
        .set({ jobId, updatedAt: new Date() })
        .where(eq(bulkPostBatches.id, batch.id));
    } catch {
      await this.database.db
        .update(bulkPostBatches)
        .set({
          status: 'failed',
          errorCode: 'BULK_POST_QUEUE_UNAVAILABLE',
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bulkPostBatches.id, batch.id));
      throw new AppException(
        'BULK_POST_QUEUE_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.serialize(
      { ...batch, jobId },
      file.name,
      parsed.data.targetSocialAccountIds,
    );
  }

  async cancel(session: PortalAuthSession, id: string): Promise<void> {
    this.requireManage(session);
    const batchId = this.parseId(id);
    const { batch } = await this.find(session.workspace.id, batchId);
    if (!['queued', 'processing'].includes(batch.status)) {
      throw new AppException(
        'BULK_POST_BATCH_NOT_CANCELLABLE',
        HttpStatus.CONFLICT,
      );
    }
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(bulkPostBatches)
        .set({ status: 'cancelled', finishedAt: now, updatedAt: now })
        .where(
          and(
            eq(bulkPostBatches.id, batchId),
            eq(bulkPostBatches.workspaceId, session.workspace.id),
          ),
        );
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'bulk_posts.batch_cancelled',
        subjectType: 'bulk_post_batch',
        subjectId: batchId,
        metadata: {},
      });
    });
  }

  private async find(workspaceId: string, id: string) {
    const [result] = await this.database.db
      .select({ batch: bulkPostBatches, fileName: fileAssets.name })
      .from(bulkPostBatches)
      .innerJoin(
        fileAssets,
        eq(bulkPostBatches.sourceFileAssetId, fileAssets.id),
      )
      .where(
        and(
          eq(bulkPostBatches.id, id),
          eq(bulkPostBatches.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!result) {
      throw new AppException('BULK_POST_BATCH_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  private async targetsByBatch(batchIds: string[]) {
    const output = new Map<string, string[]>();
    if (!batchIds.length) return output;
    const rows = await this.database.db
      .select()
      .from(bulkPostBatchTargets)
      .where(inArray(bulkPostBatchTargets.batchId, batchIds));
    for (const row of rows) {
      const ids = output.get(row.batchId) ?? [];
      ids.push(row.socialAccountId);
      output.set(row.batchId, ids);
    }
    return output;
  }

  private serialize(
    batch: typeof bulkPostBatches.$inferSelect,
    sourceFileName: string,
    targetAccountIds: string[],
  ): PortalBulkPostBatch {
    return {
      id: batch.id,
      sourceFileAssetId: batch.sourceFileAssetId,
      sourceFileName,
      status: batch.status,
      intervalMinutes: batch.intervalMinutes,
      timezone: batch.timezone,
      targetAccountIds,
      totalRows: batch.totalRows,
      validRows: batch.validRows,
      invalidRows: batch.invalidRows,
      createdPosts: batch.createdPosts,
      failedRows: batch.failedRows,
      errorCode: batch.errorCode,
      startedAt: batch.startedAt?.toISOString() ?? null,
      finishedAt: batch.finishedAt?.toISOString() ?? null,
      createdAt: batch.createdAt.toISOString(),
    };
  }

  private requireManage(session: PortalAuthSession) {
    if (!managerRoles.has(session.workspace.role)) {
      throw new AppException(
        'BULK_POST_MANAGE_FORBIDDEN',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private parseId(value: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      throw new AppException('BULK_POST_BATCH_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return value;
  }

  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private failed() {
    return new AppException(
      'BULK_POST_CREATE_FAILED',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
