import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminEmailTemplatesController } from './admin-email-templates.controller';
import { EmailModule } from './email.module';

@Module({
  imports: [IdentityModule, EmailModule],
  controllers: [AdminEmailTemplatesController],
})
export class AdminEmailTemplatesModule {}
