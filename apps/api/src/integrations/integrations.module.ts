import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import {
  IntegrationsController,
  WhatsAppStatusIntegrationsController,
} from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [IdentityModule],
  controllers: [IntegrationsController, WhatsAppStatusIntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
