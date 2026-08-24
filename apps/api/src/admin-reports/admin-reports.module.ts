import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PlanAccessModule } from '../plans/plan-access.module';
import {
  AdminTeamsController,
  AdminUserReportController,
} from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';

@Module({
  imports: [IdentityModule, PlanAccessModule],
  controllers: [AdminUserReportController, AdminTeamsController],
  providers: [AdminReportsService],
})
export class AdminReportsModule {}
