import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { TeamsModule } from '../teams/teams.module';
import { BulkPostsController } from './bulk-posts.controller';
import { BULK_POST_BATCH_QUEUE } from './bulk-posts.constants';
import { BulkPostsService } from './bulk-posts.service';

@Module({
  imports: [
    IdentityModule,
    TeamsModule,
    BullModule.registerQueue({ name: BULK_POST_BATCH_QUEUE }),
  ],
  controllers: [BulkPostsController],
  providers: [BulkPostsService],
})
export class BulkPostsModule {}
