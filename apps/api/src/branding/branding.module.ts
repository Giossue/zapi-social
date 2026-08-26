import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [BrandingController],
  providers: [BrandingService],
})
export class BrandingModule {}
