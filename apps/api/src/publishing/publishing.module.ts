import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { IdentityModule } from '../identity/identity.module';
import { PlanAccessModule } from '../plans/plan-access.module';
import { TeamsModule } from '../teams/teams.module';
import {
  PublicPublishingMediaController,
  PublishingController,
} from './publishing.controller';
import { PUBLISHING_DELIVERY_QUEUE } from './publishing.constants';
import { PublishingService } from './publishing.service';

@Module({
  imports: [
    AutomationModule,
    IdentityModule,
    PlanAccessModule,
    TeamsModule,
    BullModule.registerQueue({ name: PUBLISHING_DELIVERY_QUEUE }),
  ],
  controllers: [PublishingController, PublicPublishingMediaController],
  providers: [PublishingService],
})
export class PublishingModule {}
