import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [IdentityModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
