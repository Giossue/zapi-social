import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { CaptchaService } from './captcha.service';

@ApiTags('admin-settings')
@Controller('v1/admin/settings/turnstile')
export class CaptchaAdminController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly captcha: CaptchaService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.captcha.getAdminConfiguration();
  }

  @Patch()
  async save(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.captcha.saveAdminConfiguration(
      body,
      await this.access.requirePlatformAdmin(request),
    );
  }
}
