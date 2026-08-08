import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  PUBLISHING_DELIVERY_QUEUE,
  PUBLISHING_DISPATCH_INTERVAL_MS,
  PUBLISHING_DISPATCH_JOB,
  type PublishingDispatchJobData,
} from './publishing.constants';
import { PublishingDeliveryProcessor } from './publishing-delivery.processor';

@Injectable()
export class PublishingDeliveryScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(PUBLISHING_DELIVERY_QUEUE)
    private readonly queue: Queue<PublishingDispatchJobData>,
    private readonly processor: PublishingDeliveryProcessor,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.add(
      PUBLISHING_DISPATCH_JOB,
      {},
      {
        jobId: 'global-publishing-dispatcher',
        repeat: { every: PUBLISHING_DISPATCH_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    await this.processor.enqueueDue();
  }
}
