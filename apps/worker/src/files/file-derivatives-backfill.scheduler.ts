import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { fileAssets } from '@workspace/database';
import { and, eq, ilike, or } from '@workspace/database/query';
import type { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import {
  FILE_DERIVATIVES_JOB,
  FILE_DERIVATIVES_QUEUE,
} from './file-derivatives.constants';

const backfillLimit = 100;

@Injectable()
export class FileDerivativesBackfillScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(FileDerivativesBackfillScheduler.name);

  constructor(
    private readonly database: DatabaseService,
    @InjectQueue(FILE_DERIVATIVES_QUEUE)
    private readonly derivatives: Queue,
  ) {}

  async onApplicationBootstrap() {
    const assets = await this.database.db
      .select({ id: fileAssets.id })
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.status, 'ready'),
          or(
            eq(fileAssets.thumbnailStatus, 'not_applicable'),
            eq(fileAssets.thumbnailStatus, 'pending'),
          ),
          or(
            ilike(fileAssets.mimeType, 'image/%'),
            ilike(fileAssets.mimeType, 'video/%'),
          ),
        ),
      )
      .limit(backfillLimit);
    if (!assets.length) return;

    await this.derivatives.addBulk(
      assets.map((asset) => ({
        name: FILE_DERIVATIVES_JOB,
        data: { assetId: asset.id },
        opts: {
          jobId: `thumbnail-${asset.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      })),
    );
    this.logger.log({ count: assets.length }, 'Queued legacy file thumbnails');
  }
}
