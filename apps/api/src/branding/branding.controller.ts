import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { BrandingService } from './branding.service';

@ApiTags('branding')
@Controller('v1')
export class BrandingController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly branding: BrandingService,
  ) {}

  @Get('public/branding')
  async publicBranding(@Res() reply: FastifyReply) {
    return reply
      .header('cache-control', 'public, max-age=60')
      .send(await this.branding.publicBranding());
  }

  @Get('public/branding/:asset')
  async asset(@Res() reply: FastifyReply, @Param('asset') asset: string) {
    const file = await this.branding.read(asset);
    return reply
      .type(file.mimeType)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('content-length', String(file.size))
      .send(file.stream);
  }

  @Post('admin/settings/branding/:asset')
  async upload(@Req() request: FastifyRequest, @Param('asset') asset: string) {
    await this.access.requirePlatformAdmin(request);
    return this.branding.upload(asset, request.raw);
  }

  @Delete('admin/settings/branding/:asset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear(@Req() request: FastifyRequest, @Param('asset') asset: string) {
    await this.access.requirePlatformAdmin(request);
    await this.branding.clear(asset);
  }
}
