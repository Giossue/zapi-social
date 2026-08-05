import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  RSS_SCHEDULE_DISPATCH_INTERVAL_MS,
  RSS_SCHEDULE_DISPATCH_JOB,
  RSS_SCHEDULE_DISPATCH_QUEUE,
  type RssScheduleDispatchJobData,
} from './rss-schedules.constants';
import { RssScheduleDispatchProcessor } from './rss-schedule-dispatch.processor';

@Injectable()
export class RssScheduleDispatchScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(RSS_SCHEDULE_DISPATCH_QUEUE)
    private readonly dispatches: Queue<RssScheduleDispatchJobData>,
    private readonly dispatchProcessor: RssScheduleDispatchProcessor,
  ) {}

  async onApplicationBootstrap() {
    await this.dispatches.add(
      RSS_SCHEDULE_DISPATCH_JOB,
      {},
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        jobId: 'global-rss-schedule-dispatcher',
        removeOnComplete: true,
        removeOnFail: true,
        repeat: { every: RSS_SCHEDULE_DISPATCH_INTERVAL_MS },
      },
    );
    await this.dispatchProcessor.recoverQueuedRuns();
  }
}
