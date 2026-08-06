import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { CaptionsModule } from './captions/captions.module';
import { ChannelsModule } from './channels/channels.module';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health/health.controller';
import { IdentityModule } from './identity/identity.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PlansModule } from './plans/plans.module';
import { FilesModule } from './files/files.module';
import { PublishingModule } from './publishing/publishing.module';
import { AuditModule } from './audit/audit.module';
import { RssSchedulesModule } from './rss-schedules/rss-schedules.module';
import { SupportModule } from './support/support.module';
import { WatermarksModule } from './watermarks/watermarks.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: {
          ignore: (request) =>
            request.url?.startsWith('/v1/oauth/channels/') ?? false,
        },
      },
    }),
    DatabaseModule,
    CaptionsModule,
    ChannelsModule,
    DashboardModule,
    IntegrationsModule,
    PlansModule,
    FilesModule,
    PublishingModule,
    RssSchedulesModule,
    SupportModule,
    WatermarksModule,
    TeamsModule,
    AuditModule,
    IdentityModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
