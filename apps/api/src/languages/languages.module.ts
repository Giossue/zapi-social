import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import {
  AdminLanguagesController,
  PublicLanguagesController,
} from './languages.controller';
import { LanguagesService } from './languages.service';

@Module({
  imports: [IdentityModule],
  controllers: [PublicLanguagesController, AdminLanguagesController],
  providers: [LanguagesService],
  exports: [LanguagesService],
})
export class LanguagesModule {}
