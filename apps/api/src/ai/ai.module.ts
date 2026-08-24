import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { IdentityModule } from '../identity/identity.module';
import { PlanAccessModule } from '../plans/plan-access.module';
import { TeamsModule } from '../teams/teams.module';
import { AdminAiController } from './admin-ai.controller';
import { AdminAiService } from './admin-ai.service';
import { AiController } from './ai.controller';
import { AI_REQUEST_QUEUE } from './ai.constants';
import { AiService } from './ai.service';

@Module({
  imports: [
    AutomationModule,
    IdentityModule,
    PlanAccessModule,
    TeamsModule,
    BullModule.registerQueue({ name: AI_REQUEST_QUEUE }),
  ],
  controllers: [AiController, AdminAiController],
  providers: [AiService, AdminAiService],
})
export class AiModule {}
