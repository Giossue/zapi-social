import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Queue, type Job } from 'bullmq'
import { DatabaseService } from '../database/database.service'
import {
  META_PROFILE_SCHEDULE_JOB,
  META_PROFILE_SCHEDULE_QUEUE,
  META_PROFILE_SYNC_BATCH_SIZE,
  META_PROFILE_SYNC_JOB,
  META_PROFILE_SYNC_QUEUE,
  type MetaProfileSyncJobData,
} from './meta-profile-sync.constants'

@Injectable()
@Processor(META_PROFILE_SCHEDULE_QUEUE)
export class MetaProfileScheduleProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue(META_PROFILE_SYNC_QUEUE) private readonly profileQueue: Queue<MetaProfileSyncJobData>,
  ) {
    super()
  }

  async process(job: Job): Promise<void> {
    if (job.name !== META_PROFILE_SCHEDULE_JOB) return

    const accounts = await this.database.client<{ id: string }[]>`
      select accounts.id
      from social_accounts as accounts
      inner join social_account_credentials as credentials
        on credentials.social_account_id = accounts.id
      where accounts.provider_key = 'meta'
        and accounts.status = 'active'
        and accounts.capability_key in ('facebook_page', 'instagram_profile')
        and (
          accounts.metadata ->> 'profileSyncDueAt' is null
          or accounts.metadata ->> 'profileSyncDueAt' <= ${new Date().toISOString()}
        )
      order by accounts.metadata ->> 'profileSyncDueAt' asc nulls first
      limit ${META_PROFILE_SYNC_BATCH_SIZE}
    `

    await Promise.all(
      accounts.map((account) =>
        this.profileQueue.add(
          META_PROFILE_SYNC_JOB,
          { accountId: account.id },
          {
            jobId: `meta-profile-sync:${account.id}`,
            attempts: 2,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: true,
            removeOnFail: true,
          },
        ),
      ),
    )
  }
}
