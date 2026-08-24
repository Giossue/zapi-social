import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminRolesController } from './admin-roles.controller';
import { AdminRolesService } from './admin-roles.service';

@Module({
  imports: [IdentityModule],
  controllers: [AdminRolesController],
  providers: [AdminRolesService],
})
export class AdminRolesModule {}
