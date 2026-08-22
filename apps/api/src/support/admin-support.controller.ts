import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { AdminSupportService } from './admin-support.service';

@ApiTags('admin-support')
@Controller('v1/admin/support')
export class AdminSupportController {
  constructor(
    private readonly support: AdminSupportService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.support.list(query);
  }

  @Get(':id')
  async get(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.access.requirePlatformAdmin(request);
    return this.support.get(id);
  }

  @Post(':id/comments')
  async reply(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.support.reply(
      await this.access.requirePlatformAdmin(request),
      id,
      body,
    );
  }

  @Patch(':id/status')
  async setStatus(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.support.setStatus(
      await this.access.requirePlatformAdmin(request),
      id,
      body,
    );
  }
}
