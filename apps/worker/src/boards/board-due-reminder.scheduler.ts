import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  BOARD_DUE_REMINDER_INTERVAL_MS,
  BOARD_DUE_REMINDER_JOB,
  BOARD_DUE_REMINDER_QUEUE,
} from './boards.constants';

@Injectable()
export class BoardDueReminderScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(BOARD_DUE_REMINDER_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.add(
      BOARD_DUE_REMINDER_JOB,
      {},
      {
        jobId: 'global-board-due-reminder-scheduler',
        repeat: { every: BOARD_DUE_REMINDER_INTERVAL_MS },
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
