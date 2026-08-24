import { Module } from '@nestjs/common';
import { PlanAccessService } from './plan-access.service';

@Module({
  providers: [PlanAccessService],
  exports: [PlanAccessService],
})
export class PlanAccessModule {}
