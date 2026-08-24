import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CaptionsModule } from './captions/captions.module';
import { ChannelsModule } from './channels/channels.module';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health/health.controller';
import { SystemInformationController } from './platform/system-information.controller';
import { ContentModule } from './content/content.module';
import { LanguagesModule } from './languages/languages.module';
import { AdminRolesModule } from './admin-roles/admin-roles.module';
import { AdminReportsModule } from './admin-reports/admin-reports.module';
import { LinkBioModule } from './link-bio/link-bio.module';
import { PlatformSettingsModule } from './settings/platform-settings.module';
import { IdentityModule } from './identity/identity.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PlansModule } from './plans/plans.module';
import { FilesModule } from './files/files.module';
import { PublishingModule } from './publishing/publishing.module';
import { AuditModule } from './audit/audit.module';
import { RssSchedulesModule } from './rss-schedules/rss-schedules.module';
import { AdminEmailTemplatesModule } from './email/admin-email-templates.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PublicSiteModule } from './public-site/public-site.module';
import { SupportModule } from './support/support.module';
import { WatermarksModule } from './watermarks/watermarks.module';
import { BoardsModule } from './boards/boards.module';
import { TeamsModule } from './teams/teams.module';
import { GroupsModule } from './groups/groups.module';
import { BulkPostsModule } from './bulk-posts/bulk-posts.module';
import { AutomationModule } from './automation/automation.module';
import { AiModule } from './ai/ai.module';
import { CommerceModule } from './commerce/commerce.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { OnlineMediaModule } from './online-media/online-media.module';
import { BillingModule } from './billing/billing.module';
import { CaptchaAdminModule } from './captcha/captcha-admin.module';
import { CaptchaModule } from './captcha/captcha.module';
import { SetupModule } from './setup/setup.module';
import { DemoModeGuard } from './platform/demo-mode.guard';

const pinoRedactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'req.headers["webhook-signature"]',
  'req.cookies',
  'req.query.apiKey',
  'req.query.code',
  'req.query.signature',
  'req.query.token',
  'req.params.token',
  'req.body.access_token',
  'req.body.accessToken',
  'req.body.apiKey',
  'req.body.authorization',
  'req.body.client_secret',
  'req.body.clientSecret',
  'req.body.cookie',
  'req.body.credentials',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.password',
  'req.body.passwordConfirmation',
  'req.body.refresh_token',
  'req.body.refreshToken',
  'req.body.secret',
  'req.body.secretKey',
  'req.body.signingSecret',
  'req.body.token',
  'req.body.tokenHash',
  'req.body.turnstileToken',
  'req.body.*.accessToken',
  'req.body.*.apiKey',
  'req.body.*.password',
  'req.body.*.secret',
  'req.body.*.token',
  'req.body.files.*.providerFileId',
  'req.body.files.*.resourceKey',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  'headers["x-api-key"]',
  'headers["webhook-signature"]',
  'access_token',
  'accessToken',
  'accessTokenCiphertext',
  'apiKey',
  'authorization',
  'client_secret',
  'clientSecret',
  'cookie',
  'credentials',
  'currentPassword',
  'newPassword',
  'password',
  'passwordHash',
  'pkceVerifier',
  'refresh_token',
  'refreshToken',
  'refreshTokenCiphertext',
  'providerFileId',
  'providerFileIdCiphertext',
  'resourceKey',
  'resourceKeyCiphertext',
  'secret',
  'secretKey',
  'setCookie',
  'signingSecret',
  'signingSecretCiphertext',
  'token',
  'tokenHash',
  'turnstileToken',
] as const;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          censor: '[REDACTED]',
          paths: [...pinoRedactPaths],
        },
        autoLogging: {
          ignore: (request) =>
            request.url?.startsWith('/v1/oauth/channels/') ?? false,
        },
      },
    }),
    DatabaseModule,
    CaptchaModule,
    CaptionsModule,
    ChannelsModule,
    DashboardModule,
    IntegrationsModule,
    PlansModule,
    FilesModule,
    PublishingModule,
    RssSchedulesModule,
    AdminEmailTemplatesModule,
    NotificationsModule,
    PublicSiteModule,
    SupportModule,
    WatermarksModule,
    BoardsModule,
    TeamsModule,
    GroupsModule,
    BulkPostsModule,
    AutomationModule,
    AiModule,
    CommerceModule,
    AffiliateModule,
    OnlineMediaModule,
    BillingModule,
    AuditModule,
    ContentModule,
    LanguagesModule,
    AdminRolesModule,
    AdminReportsModule,
    LinkBioModule,
    PlatformSettingsModule,
    IdentityModule,
    SetupModule,
    CaptchaAdminModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
      },
    }),
  ],
  controllers: [HealthController, SystemInformationController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: DemoModeGuard },
  ],
})
export class AppModule {}
