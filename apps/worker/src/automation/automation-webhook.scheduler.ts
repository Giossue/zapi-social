import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  AUTOMATION_WEBHOOK_DISPATCH_INTERVAL_MS,
  AUTOMATION_WEBHOOK_DISPATCH_JOB,
  AUTOMATION_WEBHOOK_QUEUE,
  type AutomationWebhookDispatchJobData,
} from './automation.constants';
import { AutomationWebhookProcessor } from './automation-webhook.processor';

@Injectable()
export class AutomationWebhookScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(AUTOMATION_WEBHOOK_QUEUE)
    private readonly queue: Queue<AutomationWebhookDispatchJobData>,
    private readonly processor: AutomationWebhookProcessor,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.add(
      AUTOMATION_WEBHOOK_DISPATCH_JOB,
      {},
      {
        jobId: 'global-automation-webhook-dispatcher',
        repeat: { every: AUTOMATION_WEBHOOK_DISPATCH_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    await this.processor.enqueueDue();
  }
}
