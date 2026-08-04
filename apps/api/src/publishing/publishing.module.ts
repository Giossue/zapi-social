import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PublishingController } from './publishing.controller';
import { PublishingService } from './publishing.service';

@Module({
  imports: [IdentityModule],
  controllers: [PublishingController],
  providers: [PublishingService],
})
export class PublishingModule {}
