import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { IdentityModule } from '../identity/identity.module';
import { ChannelProviderIntegrationsService } from './channel-provider-integrations.service';
import { CHANNEL_PROVIDER_VERIFIERS } from './channel-provider-verifier';
import { LinkedInProviderVerifier } from './verifiers/linkedin-provider.verifier';
import {
  ChannelProviderIntegrationsController,
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
    ChannelProviderIntegrationsController,
  ],
  providers: [
    IntegrationsService,
    ChannelProviderIntegrationsService,
    LinkedInProviderVerifier,
    {
      // Añadir una red es sumar su verificador aquí. Mientras no lo tenga, su
      // integración se queda en «sin probar» y el Portal no abre el canal.
      provide: CHANNEL_PROVIDER_VERIFIERS,
      inject: [LinkedInProviderVerifier],
      useFactory: (linkedin: LinkedInProviderVerifier) => [linkedin],
    },
  ],
  exports: [IntegrationsService, ChannelProviderIntegrationsService],
})
export class IntegrationsModule {}
