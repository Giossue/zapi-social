import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  PLAN_TRANSITIONS_INTERVAL_MS,
  PLAN_TRANSITIONS_JOB,
  PLAN_TRANSITIONS_QUEUE,
} from './plan-transitions.constants';

@Injectable()
export class PlanTransitionsScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(PLAN_TRANSITIONS_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.add(
      PLAN_TRANSITIONS_JOB,
      {},
      {
        jobId: 'global-plan-transitions-scheduler',
        repeat: { every: PLAN_TRANSITIONS_INTERVAL_MS },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
