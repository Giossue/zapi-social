import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PortalProfileService } from './portal-profile.service';
import { ProfileAvatarService } from './profile-avatar.service';
import { SessionAccessService } from './session-access.service';

@ApiTags('admin-profile')
@Controller('v1/admin/profile')
export class AdminProfileController {
  constructor(
    private readonly profiles: PortalProfileService,
    private readonly avatars: ProfileAvatarService,
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

  @Get('avatar')
  async readAvatar(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    const avatar = await this.avatars.read(
      await this.access.requirePlatformAdmin(request),
    );
    return reply
      .type(avatar.mimeType)
      .header('cache-control', 'private, max-age=31536000, immutable')
      .header('content-length', String(avatar.size))
      .send(avatar.stream);
  }

  @Post('avatar')
  async uploadAvatar(@Req() request: FastifyRequest) {
    return this.avatars.upload(
      await this.access.requirePlatformAdmin(request),
      request.raw,
    );
  }

  @Delete('avatar')
  @HttpCode(204)
  async removeAvatar(@Req() request: FastifyRequest) {
    await this.avatars.remove(await this.access.requirePlatformAdmin(request));
  }
}
