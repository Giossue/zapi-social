import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OnlineMediaController } from './online-media.controller';
import { OnlineMediaService } from './online-media.service';

@Module({
  imports: [
    IdentityModule,
    BullModule.registerQueue({ name: 'file-derivatives' }),
  ],
  controllers: [OnlineMediaController],
  providers: [OnlineMediaService],
})
export class OnlineMediaModule {}
