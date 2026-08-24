import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { TeamsModule } from '../teams/teams.module';
import { RssSchedulesController } from './rss-schedules.controller';
import { RssFeedValidationService } from './rss-feed-validation.service';
import { RSS_SCHEDULE_RUN_QUEUE } from './rss-schedules.constants';
import { RssSchedulesService } from './rss-schedules.service';

@Module({
  imports: [
    IdentityModule,
    TeamsModule,
    BullModule.registerQueue({ name: RSS_SCHEDULE_RUN_QUEUE }),
  ],
  controllers: [RssSchedulesController],
  providers: [RssFeedValidationService, RssSchedulesService],
})
export class RssSchedulesModule {}
