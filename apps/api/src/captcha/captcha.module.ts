import { Module } from '@nestjs/common';
import { CaptchaPublicController } from './captcha-public.controller';
import { CaptchaService } from './captcha.service';

@Module({
  controllers: [CaptchaPublicController],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
