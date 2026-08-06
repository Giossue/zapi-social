import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { IdentityModule } from '../identity/identity.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [EmailModule, IdentityModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
