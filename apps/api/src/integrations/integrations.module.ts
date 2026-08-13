import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { IdentityModule } from '../identity/identity.module';
import {
  EmailSmtpIntegrationsController,
  GoogleDriveIntegrationsController,
  IntegrationsController,
  WhatsAppStatusIntegrationsController,
} from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [EmailModule, IdentityModule],
  controllers: [
    IntegrationsController,
    WhatsAppStatusIntegrationsController,
    EmailSmtpIntegrationsController,
    GoogleDriveIntegrationsController,
  ],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
