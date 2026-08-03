import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue, type Job } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import {
  WHATSAPP_PROFILE_SCHEDULE_JOB,
  WHATSAPP_PROFILE_SCHEDULE_QUEUE,
  WHATSAPP_PROFILE_SYNC_BATCH_SIZE,
  WHATSAPP_PROFILE_SYNC_JOB,
  WHATSAPP_PROFILE_SYNC_QUEUE,
  type WhatsAppProfileSyncJobData,
} from './whatsapp-profile-sync.constants';

@Injectable()
@Processor(WHATSAPP_PROFILE_SCHEDULE_QUEUE)
export class WhatsAppProfileScheduleProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue(WHATSAPP_PROFILE_SYNC_QUEUE)
    private readonly profileQueue: Queue<WhatsAppProfileSyncJobData>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== WHATSAPP_PROFILE_SCHEDULE_JOB) return;

    const accounts = await this.database.client<{ id: string }[]>`
      select accounts.id
      from social_accounts as accounts
      where accounts.provider_key = 'whatsapp-status'
        and accounts.capability_key = 'whatsapp_status'
        and accounts.status = 'active'
        and (
          accounts.metadata ->> 'profileSyncDueAt' is null
          or accounts.metadata ->> 'profileSyncDueAt' <= ${new Date().toISOString()}
        )
      order by accounts.metadata ->> 'profileSyncDueAt' asc nulls first
      limit ${WHATSAPP_PROFILE_SYNC_BATCH_SIZE}
    `;

    await Promise.all(
      accounts.map((account) =>
        this.profileQueue.add(
          WHATSAPP_PROFILE_SYNC_JOB,
          { accountId: account.id },
          {
            jobId: `whatsapp-profile-sync:${account.id}`,
            attempts: 2,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: true,
            removeOnFail: true,
          },
        ),
      ),
    );
  }
}
