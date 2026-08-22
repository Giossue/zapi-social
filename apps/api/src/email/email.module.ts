import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminEmailTemplatesController } from './admin-email-templates.controller';
import { EmailService } from './email.service';
import { EmailTemplatesService } from './email-templates.service';

@Module({
  imports: [IdentityModule],
  controllers: [AdminEmailTemplatesController],
  providers: [EmailService, EmailTemplatesService],
  exports: [EmailService, EmailTemplatesService],
})
export class EmailModule {}
