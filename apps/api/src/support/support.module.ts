import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [IdentityModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
