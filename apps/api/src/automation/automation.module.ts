import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import {
  AutomationExternalController,
  AutomationPortalController,
} from './automation.controller';
import { AutomationEventsService } from './automation-events.service';
import { AutomationService } from './automation.service';

@Module({
  imports: [IdentityModule],
  controllers: [AutomationPortalController, AutomationExternalController],
  providers: [AutomationEventsService, AutomationService],
  exports: [AutomationEventsService, AutomationService],
})
export class AutomationModule {}
