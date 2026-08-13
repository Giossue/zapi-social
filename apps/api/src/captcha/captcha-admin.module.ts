import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CaptchaAdminController } from './captcha-admin.controller';
import { CaptchaModule } from './captcha.module';

@Module({
  imports: [CaptchaModule, IdentityModule],
  controllers: [CaptchaAdminController],
})
export class CaptchaAdminModule {}
