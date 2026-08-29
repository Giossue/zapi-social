import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { IdentityModule } from '../identity/identity.module';
import { TeamsModule } from '../teams/teams.module';
import { BoardNotificationsService } from './board-notifications.service';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';

@Module({
  imports: [EmailModule, IdentityModule, TeamsModule],
  controllers: [BoardsController],
  providers: [BoardNotificationsService, BoardsService],
  exports: [BoardNotificationsService],
})
export class BoardsModule {}
