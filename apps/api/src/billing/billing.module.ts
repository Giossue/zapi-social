import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { BillingPolarController } from './billing-polar.controller';
import { BillingPolarService } from './billing-polar.service';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingWebhookService } from './billing-webhook.service';

@Module({
  imports: [IdentityModule],
  controllers: [
    AdminOperationsController,
    BillingPolarController,
    BillingWebhookController,
  ],
  providers: [
    AdminOperationsService,
    BillingPolarService,
    BillingWebhookService,
  ],
  exports: [BillingPolarService],
})
export class BillingModule {}
