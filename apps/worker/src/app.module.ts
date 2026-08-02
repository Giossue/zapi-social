import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { validateEnv } from './config/env'
import { DatabaseService } from './database/database.service'
import {
  META_PROFILE_SCHEDULE_QUEUE,
  META_PROFILE_SYNC_QUEUE,
} from './meta-profile-sync/meta-profile-sync.constants'
import { MetaProfileScheduleProcessor } from './meta-profile-sync/meta-profile-schedule.processor'
import { MetaProfileSyncProcessor } from './meta-profile-sync/meta-profile-sync.processor'
import { MetaProfileSyncScheduler } from './meta-profile-sync/meta-profile-sync.scheduler'
import { Aes256GcmService } from './platform/crypto/aes-256-gcm.service'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: { level: process.env.LOG_LEVEL ?? 'info' },
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
      },
    }),
    BullModule.registerQueue(
      { name: META_PROFILE_SCHEDULE_QUEUE },
      { name: META_PROFILE_SYNC_QUEUE },
    ),
  ],
  providers: [
    Aes256GcmService,
    DatabaseService,
    MetaProfileSyncScheduler,
    MetaProfileScheduleProcessor,
    MetaProfileSyncProcessor,
  ],
})
export class AppModule {}
