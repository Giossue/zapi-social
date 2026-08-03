import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  META_PROFILE_SCHEDULE_JOB,
  META_PROFILE_SCHEDULE_QUEUE,
  META_PROFILE_SYNC_INTERVAL_MS,
} from './meta-profile-sync.constants';

@Injectable()
export class MetaProfileSyncScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(META_PROFILE_SCHEDULE_QUEUE)
    private readonly scheduleQueue: Queue,
  ) {}

  async onApplicationBootstrap() {
    await this.scheduleQueue.add(
      META_PROFILE_SCHEDULE_JOB,
      {},
      {
        jobId: 'global-meta-profile-sync-scheduler',
        repeat: { every: META_PROFILE_SYNC_INTERVAL_MS },
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
