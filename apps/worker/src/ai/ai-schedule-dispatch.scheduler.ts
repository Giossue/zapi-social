import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  AI_SCHEDULE_DISPATCH_INTERVAL_MS,
  AI_SCHEDULE_DISPATCH_JOB,
  AI_SCHEDULE_DISPATCH_QUEUE,
  type AiScheduleDispatchJobData,
} from './ai.constants';
import { AiScheduleDispatchProcessor } from './ai-schedule-dispatch.processor';

@Injectable()
export class AiScheduleDispatchScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(AI_SCHEDULE_DISPATCH_QUEUE)
    private readonly dispatches: Queue<AiScheduleDispatchJobData>,
    private readonly processor: AiScheduleDispatchProcessor,
  ) {}

  async onApplicationBootstrap() {
    await this.dispatches.add(
      AI_SCHEDULE_DISPATCH_JOB,
      {},
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        jobId: 'global-ai-schedule-dispatcher',
        removeOnComplete: true,
        removeOnFail: true,
        repeat: { every: AI_SCHEDULE_DISPATCH_INTERVAL_MS },
      },
    );
    await this.processor.recoverQueuedRequests();
  }
}
