import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { LinkBioService } from './link-bio.service';

@ApiTags('portal-link-bio')
@Controller('v1/portal/link-bio')
export class LinkBioController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly pages: LinkBioService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    return this.pages.list(await this.access.requirePortalSession(request));
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.pages.save(
      await this.access.requirePortalSession(request),
      null,
      body,
    );
  }

  @Patch(':id')
  async update(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.pages.save(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Delete(':id')
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.pages.remove(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}

/** Superficie pública: sin sesión, solo páginas publicadas. */
@ApiTags('public-link-bio')
@Controller('v1/public/link-bio')
export class PublicLinkBioController {
  constructor(private readonly pages: LinkBioService) {}

  @Get(':slug')
  async page(@Param('slug') slug: string) {
    return this.pages.publicPage(slug);
  }

  @Post(':slug/events')
  async track(
    @Req() request: FastifyRequest,
    @Param('slug') slug: string,
    @Body() body: unknown,
  ) {
    return this.pages.track(
      slug,
      body,
      request.ip ?? null,
      request.headers['user-agent'] ?? null,
    );
  }
}
