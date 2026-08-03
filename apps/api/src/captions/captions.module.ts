import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CaptionsController } from './captions.controller';
import { CaptionsService } from './captions.service';

@Module({
  imports: [IdentityModule],
  controllers: [CaptionsController],
  providers: [CaptionsService],
})
export class CaptionsModule {}
