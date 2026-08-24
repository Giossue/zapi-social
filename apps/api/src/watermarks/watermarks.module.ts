import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { TeamsModule } from '../teams/teams.module';
import { WatermarksController } from './watermarks.controller';
import { WatermarksService } from './watermarks.service';

@Module({
  imports: [IdentityModule, TeamsModule],
  controllers: [WatermarksController],
  providers: [WatermarksService],
})
export class WatermarksModule {}
