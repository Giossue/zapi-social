import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminManualPaymentsController } from './admin-manual-payments.controller';
import { AdminManualPaymentsService } from './admin-manual-payments.service';
import { AdminPaymentReportController } from './admin-payment-report.controller';
import { AdminPaymentReportService } from './admin-payment-report.service';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { BillingPolarController } from './billing-polar.controller';
import { BillingPolarService } from './billing-polar.service';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingWebhookService } from './billing-webhook.service';
import { PortalBillingController } from './portal-billing.controller';
import { PortalBillingService } from './portal-billing.service';
import { PortalPlanChangesController } from './portal-plan-changes.controller';
import { PortalPlanChangesService } from './portal-plan-changes.service';

@Module({
  imports: [IdentityModule],
  controllers: [
    AdminOperationsController,
    AdminPaymentReportController,
    AdminManualPaymentsController,
    BillingPolarController,
    BillingWebhookController,
    PortalBillingController,
    PortalPlanChangesController,
  ],
  providers: [
    AdminOperationsService,
    AdminPaymentReportService,
    AdminManualPaymentsService,
    BillingPolarService,
    BillingWebhookService,
    PortalBillingService,
    PortalPlanChangesService,
  ],
  exports: [BillingPolarService],
})
export class BillingModule {}
