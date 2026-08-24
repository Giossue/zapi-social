import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PlanAccessModule } from './plan-access.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [IdentityModule, PlanAccessModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
