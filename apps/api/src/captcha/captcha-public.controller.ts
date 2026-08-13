import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CaptchaService } from './captcha.service';

@ApiTags('auth')
@Controller('v1/auth/turnstile')
export class CaptchaPublicController {
  constructor(private readonly captcha: CaptchaService) {}

  @Get()
  async getConfiguration() {
    return this.captcha.getPublicConfiguration();
  }
}
