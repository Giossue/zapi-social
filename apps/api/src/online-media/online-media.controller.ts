import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { OnlineMediaService } from './online-media.service';

@ApiTags('portal-online-media')
@Controller('v1/portal/online-media')
export class OnlineMediaController {
  constructor(
    private readonly media: OnlineMediaService,
    private readonly access: SessionAccessService,
  ) {}

  @Get('search')
  async search(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.media.search(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Post('imports')
  async import(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.media.import(
      await this.access.requirePortalSession(request),
      body,
    );
  }
}
