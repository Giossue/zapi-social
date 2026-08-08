import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [IdentityModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
