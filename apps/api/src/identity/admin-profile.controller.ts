import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { PortalProfileService } from './portal-profile.service';
import { SessionAccessService } from './session-access.service';

@ApiTags('admin-profile')
@Controller('v1/admin/profile')
export class AdminProfileController {
  constructor(
    private readonly profiles: PortalProfileService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async getProfile(@Req() request: FastifyRequest) {
    return this.profiles.getProfile(
      await this.access.requirePlatformAdmin(request),
    );
  }

  @Patch()
  async updateProfile(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.profiles.updateProfile(
      await this.access.requirePlatformAdmin(request),
      body,
    );
  }

  @Post('password')
  @HttpCode(204)
  async changePassword(@Req() request: FastifyRequest, @Body() body: unknown) {
    await this.profiles.changePassword(
      await this.access.requirePlatformAdmin(request),
      body,
    );
  }
}
