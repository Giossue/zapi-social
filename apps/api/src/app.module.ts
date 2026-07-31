import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ChannelsModule } from './channels/channels.module';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health/health.controller';
import { IdentityModule } from './identity/identity.module';
import { IntegrationsModule } from './integrations/integrations.module';

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
    ChannelsModule,
    DashboardModule,
    IntegrationsModule,
    IdentityModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
