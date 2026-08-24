import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env';
import { DatabaseService } from './database/database.service';
import {
  META_PROFILE_SCHEDULE_QUEUE,
  META_PROFILE_SYNC_QUEUE,
} from './meta-profile-sync/meta-profile-sync.constants';
import { MetaProfileScheduleProcessor } from './meta-profile-sync/meta-profile-schedule.processor';
import { MetaProfileSyncProcessor } from './meta-profile-sync/meta-profile-sync.processor';
import { MetaProfileSyncScheduler } from './meta-profile-sync/meta-profile-sync.scheduler';
import { Aes256GcmService } from './platform/crypto/aes-256-gcm.service';
import {
  WHATSAPP_PROFILE_SCHEDULE_QUEUE,
  WHATSAPP_PROFILE_SYNC_QUEUE,
} from './whatsapp-profile-sync/whatsapp-profile-sync.constants';
import { WhatsAppProfileScheduleProcessor } from './whatsapp-profile-sync/whatsapp-profile-schedule.processor';
import { BoardDueReminderProcessor } from './boards/board-due-reminder.processor';
import { BoardDueReminderScheduler } from './boards/board-due-reminder.scheduler';
import { BOARD_DUE_REMINDER_QUEUE } from './boards/boards.constants';
import { TOKEN_REFRESH_QUEUE } from './token-refresh/token-refresh.constants';
import { TokenRefreshProcessor } from './token-refresh/token-refresh.processor';
import { TokenRefreshScheduler } from './token-refresh/token-refresh.scheduler';
import { WhatsAppProfileSyncProcessor } from './whatsapp-profile-sync/whatsapp-profile-sync.processor';
import { WhatsAppProfileSyncScheduler } from './whatsapp-profile-sync/whatsapp-profile-sync.scheduler';
import { FILE_DERIVATIVES_QUEUE } from './files/file-derivatives.constants';
import { FileDerivativesBackfillScheduler } from './files/file-derivatives-backfill.scheduler';
import { FileDerivativesProcessor } from './files/file-derivatives.processor';
import { WorkerAuditService } from './audit/worker-audit.service';
import {
  RSS_SCHEDULE_DISPATCH_QUEUE,
  RSS_SCHEDULE_RUN_QUEUE,
} from './rss-schedules/rss-schedules.constants';
import { RssScheduleDispatchProcessor } from './rss-schedules/rss-schedule-dispatch.processor';
import { RssScheduleDispatchScheduler } from './rss-schedules/rss-schedule-dispatch.scheduler';
import { RssFeedReaderService } from './rss-schedules/rss-feed-reader.service';
import { RssScheduleRunProcessor } from './rss-schedules/rss-schedule-run.processor';
import { BULK_POST_BATCH_QUEUE } from './bulk-posts/bulk-posts.constants';
import { BulkPostBatchProcessor } from './bulk-posts/bulk-post-batch.processor';
import {
  AI_REQUEST_QUEUE,
  AI_SCHEDULE_DISPATCH_QUEUE,
} from './ai/ai.constants';
import { AiRequestProcessor } from './ai/ai-request.processor';
import { PlanAccessService } from './plans/plan-access.service';
import { AiScheduleDispatchProcessor } from './ai/ai-schedule-dispatch.processor';
import { AiScheduleDispatchScheduler } from './ai/ai-schedule-dispatch.scheduler';
import { AUTOMATION_WEBHOOK_QUEUE } from './automation/automation.constants';
import { AutomationWebhookEventsService } from './automation/automation-webhook-events.service';
import { AutomationWebhookProcessor } from './automation/automation-webhook.processor';
import { AutomationWebhookScheduler } from './automation/automation-webhook.scheduler';
import { PUBLISHING_DELIVERY_QUEUE } from './publishing/publishing.constants';
import { PublishingDeliveryProcessor } from './publishing/publishing-delivery.processor';
import { PublishingDeliveryScheduler } from './publishing/publishing-delivery.scheduler';
import { PublishingMediaPreparationService } from './publishing/publishing-media-preparation.service';
import { CHANNEL_PUBLISHERS } from './publishing/publishers/channel-publisher';
import { ChannelPublisherRegistry } from './publishing/publishers/channel-publisher.registry';
import { FacebookPagePublisher } from './publishing/publishers/facebook-page.publisher';
import { InstagramProfilePublisher } from './publishing/publishers/instagram-profile.publisher';
import {
  LinkedInPagePublisher,
  LinkedInProfilePublisher,
} from './publishing/publishers/linkedin.publisher';
import { TikTokPublisher } from './publishing/publishers/tiktok.publisher';
import { XPublisher } from './publishing/publishers/x.publisher';
import { MetaGraphService } from './publishing/publishers/meta-graph.service';
import { PublishingAssetReader } from './publishing/publishers/publishing-asset-reader.service';
import { WhatsAppStatusPublisher } from './publishing/publishers/whatsapp-status.publisher';
import { FILE_IMPORTS_QUEUE } from './files/file-imports.constants';
import { GoogleDriveImportProcessor } from './files/google-drive-import.processor';
import { FileImportsScheduler } from './files/file-imports.scheduler';
import { PLAN_TRANSITIONS_QUEUE } from './plans/plan-transitions.constants';
import { PlanTransitionsProcessor } from './plans/plan-transitions.processor';
import { PlanTransitionsScheduler } from './plans/plan-transitions.scheduler';

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
      { name: WHATSAPP_PROFILE_SCHEDULE_QUEUE },
      { name: WHATSAPP_PROFILE_SYNC_QUEUE },
      { name: FILE_DERIVATIVES_QUEUE },
      { name: RSS_SCHEDULE_DISPATCH_QUEUE },
      { name: RSS_SCHEDULE_RUN_QUEUE },
      { name: BULK_POST_BATCH_QUEUE },
      { name: AI_REQUEST_QUEUE },
      { name: AI_SCHEDULE_DISPATCH_QUEUE },
      { name: AUTOMATION_WEBHOOK_QUEUE },
      { name: PUBLISHING_DELIVERY_QUEUE },
      { name: FILE_IMPORTS_QUEUE },
      { name: BOARD_DUE_REMINDER_QUEUE },
      { name: TOKEN_REFRESH_QUEUE },
      { name: PLAN_TRANSITIONS_QUEUE },
    ),
  ],
  providers: [
    Aes256GcmService,
    DatabaseService,
    WorkerAuditService,
    MetaProfileSyncScheduler,
    MetaProfileScheduleProcessor,
    MetaProfileSyncProcessor,
    BoardDueReminderScheduler,
    BoardDueReminderProcessor,
    TokenRefreshScheduler,
    TokenRefreshProcessor,
    PlanTransitionsScheduler,
    PlanTransitionsProcessor,
    WhatsAppProfileSyncScheduler,
    WhatsAppProfileScheduleProcessor,
    WhatsAppProfileSyncProcessor,
    FileDerivativesBackfillScheduler,
    FileDerivativesProcessor,
    RssFeedReaderService,
    RssScheduleDispatchScheduler,
    RssScheduleDispatchProcessor,
    PlanAccessService,
    RssScheduleRunProcessor,
    BulkPostBatchProcessor,
    AiRequestProcessor,
    AiScheduleDispatchProcessor,
    AiScheduleDispatchScheduler,
    AutomationWebhookEventsService,
    AutomationWebhookProcessor,
    AutomationWebhookScheduler,
    PublishingDeliveryProcessor,
    PublishingDeliveryScheduler,
    PublishingMediaPreparationService,
    PublishingAssetReader,
    MetaGraphService,
    FacebookPagePublisher,
    InstagramProfilePublisher,
    LinkedInPagePublisher,
    LinkedInProfilePublisher,
    XPublisher,
    TikTokPublisher,
    WhatsAppStatusPublisher,
    ChannelPublisherRegistry,
    {
      provide: CHANNEL_PUBLISHERS,
      inject: [
        FacebookPagePublisher,
        InstagramProfilePublisher,
        LinkedInPagePublisher,
        LinkedInProfilePublisher,
        WhatsAppStatusPublisher,
      ],
      useFactory: (
        facebook: FacebookPagePublisher,
        instagram: InstagramProfilePublisher,
        linkedinPage: LinkedInPagePublisher,
        linkedinProfile: LinkedInProfilePublisher,
        whatsapp: WhatsAppStatusPublisher,
      ) => [facebook, instagram, linkedinPage, linkedinProfile, whatsapp],
    },
    GoogleDriveImportProcessor,
    FileImportsScheduler,
  ],
})
export class AppModule {}
