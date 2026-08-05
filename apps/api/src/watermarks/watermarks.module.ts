import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { WatermarksController } from './watermarks.controller';
import { WatermarksService } from './watermarks.service';

@Module({
  imports: [IdentityModule],
  controllers: [WatermarksController],
  providers: [WatermarksService],
})
export class WatermarksModule {}
