import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
