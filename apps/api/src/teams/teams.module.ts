import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { IdentityModule } from '../identity/identity.module';
import { PlanAccessModule } from '../plans/plan-access.module';
import { TeamAccountAccessService } from './team-account-access.service';
import { TeamsController, TeamsPublicController } from './teams.controller';
import { TeamsService } from './teams.service';
import { WorkspacePermissionsService } from './workspace-permissions.service';

@Module({
  imports: [EmailModule, IdentityModule, PlanAccessModule],
  controllers: [TeamsController, TeamsPublicController],
  providers: [
    TeamAccountAccessService,
    TeamsService,
    WorkspacePermissionsService,
  ],
  exports: [TeamAccountAccessService, WorkspacePermissionsService],
})
export class TeamsModule {}
