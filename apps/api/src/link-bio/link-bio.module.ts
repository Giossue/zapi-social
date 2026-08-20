import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import {
  LinkBioController,
  PublicLinkBioController,
} from './link-bio.controller';
import { LinkBioService } from './link-bio.service';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [LinkBioController, PublicLinkBioController],
  providers: [LinkBioService],
})
export class LinkBioModule {}
