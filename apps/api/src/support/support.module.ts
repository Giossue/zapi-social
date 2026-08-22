import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [IdentityModule],
  controllers: [AdminSupportController, SupportController],
  providers: [AdminSupportService, SupportService],
})
export class SupportModule {}
