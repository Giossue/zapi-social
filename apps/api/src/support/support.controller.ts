import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { SupportService } from './support.service';

@ApiTags('portal-support')
@Controller('v1/portal/support')
export class SupportController {
  constructor(
    private readonly support: SupportService,
    private readonly access: SessionAccessService,
  ) {}

  @Get('categories')
  async categories(@Req() request: FastifyRequest) {
    await this.access.requirePortalSession(request);
    return this.support.categories();
  }

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.support.list(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.support.create(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Get(':id')
  async get(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.support.get(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post(':id/comments')
  async addComment(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.support.addComment(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Post(':id/resolve')
  async resolve(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.support.resolve(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}
