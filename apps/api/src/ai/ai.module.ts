import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { IdentityModule } from '../identity/identity.module';
import { TeamsModule } from '../teams/teams.module';
import { AiController } from './ai.controller';
import { AI_REQUEST_QUEUE } from './ai.constants';
import { AiService } from './ai.service';

@Module({
  imports: [
    AutomationModule,
    IdentityModule,
    TeamsModule,
    BullModule.registerQueue({ name: AI_REQUEST_QUEUE }),
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
