import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { Queue } from 'bullmq'
import {
  WHATSAPP_PROFILE_SCHEDULE_JOB,
  WHATSAPP_PROFILE_SCHEDULE_QUEUE,
  WHATSAPP_PROFILE_SYNC_INTERVAL_MS,
} from './whatsapp-profile-sync.constants'

@Injectable()
export class WhatsAppProfileSyncScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(WHATSAPP_PROFILE_SCHEDULE_QUEUE) private readonly scheduleQueue: Queue) {}

  async onApplicationBootstrap() {
    await this.scheduleQueue.add(
      WHATSAPP_PROFILE_SCHEDULE_JOB,
      {},
      {
        jobId: 'global-whatsapp-profile-sync-scheduler',
        repeat: { every: WHATSAPP_PROFILE_SYNC_INTERVAL_MS },
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    )
  }
}
