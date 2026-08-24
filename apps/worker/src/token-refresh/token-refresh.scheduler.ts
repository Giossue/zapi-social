import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  TOKEN_REFRESH_INTERVAL_MS,
  TOKEN_REFRESH_JOB,
  TOKEN_REFRESH_QUEUE,
} from './token-refresh.constants';

@Injectable()
export class TokenRefreshScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(TOKEN_REFRESH_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.add(
      TOKEN_REFRESH_JOB,
      {},
      {
        jobId: 'global-channel-token-refresh-scheduler',
        repeat: { every: TOKEN_REFRESH_INTERVAL_MS },
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
