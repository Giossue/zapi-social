import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import {
  AffiliatePortalController,
  AffiliatePublicController,
} from './affiliate.controller';
import { AffiliateService } from './affiliate.service';

@Module({
  imports: [IdentityModule],
  controllers: [AffiliatePortalController, AffiliatePublicController],
  providers: [AffiliateService],
})
export class AffiliateModule {}
