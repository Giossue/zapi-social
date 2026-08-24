import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { fileImportBatches } from '@workspace/database';
import { inArray } from '@workspace/database/query';
import type { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import {
  FILE_IMPORTS_QUEUE,
  GOOGLE_DRIVE_IMPORT_JOB,
  type FileImportJobData,
} from './file-imports.constants';

const FILE_IMPORT_RECOVERY_INTERVAL_MS = 30_000;
const FILE_IMPORT_STALE_MS = 300_000;

@Injectable()
export class FileImportsScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private recoveryTimer?: NodeJS.Timeout;

  constructor(
    private readonly database: DatabaseService,
    @InjectQueue(FILE_IMPORTS_QUEUE)
    private readonly queue: Queue<FileImportJobData>,
  ) {}

  async onApplicationBootstrap() {
    await this.recover();
    this.recoveryTimer = setInterval(
      () => void this.recover().catch(() => undefined),
      FILE_IMPORT_RECOVERY_INTERVAL_MS,
    );
    this.recoveryTimer.unref();
  }

  onApplicationShutdown() {
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
  }

  private async recover() {
    const batches = await this.database.db
      .select({
        id: fileImportBatches.id,
        updatedAt: fileImportBatches.updatedAt,
      })
      .from(fileImportBatches)
      .where(inArray(fileImportBatches.status, ['pending', 'processing']))
      .limit(100);
    await Promise.allSettled(
      batches.map((batch) => this.recoverBatch(batch.id, batch.updatedAt)),
    );
  }

  private async recoverBatch(id: string, updatedAt?: Date) {
    const jobId = `google-drive-import-${id}`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      const stale =
        updatedAt !== undefined &&
        Date.now() - updatedAt.valueOf() > FILE_IMPORT_STALE_MS;
      if (state !== 'failed' && state !== 'completed' && !stale) return;
      await existing.remove();
    }
    await this.queue.add(
      GOOGLE_DRIVE_IMPORT_JOB,
      { batchId: id },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
}
