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
import { SessionAccessService } from './session-access.service';
import { PortalProfileService } from './portal-profile.service';

@ApiTags('portal-profile')
@Controller('v1/portal/profile')
export class PortalProfileController {
  constructor(
    private readonly profiles: PortalProfileService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async getProfile(@Req() request: FastifyRequest) {
    return this.profiles.getProfile(
      await this.access.requirePortalSession(request),
    );
  }

  @Patch()
  async updateProfile(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.profiles.updateProfile(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Post('password')
  @HttpCode(204)
  async changePassword(@Req() request: FastifyRequest, @Body() body: unknown) {
    await this.profiles.changePassword(
      await this.access.requirePortalSession(request),
      body,
    );
  }
}
