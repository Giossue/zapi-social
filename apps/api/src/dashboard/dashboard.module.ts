import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [IdentityModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
