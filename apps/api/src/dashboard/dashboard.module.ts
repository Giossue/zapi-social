import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [IdentityModule],
  controllers: [DashboardController, AdminDashboardController],
  providers: [DashboardService, AdminDashboardService],
})
export class DashboardModule {}
