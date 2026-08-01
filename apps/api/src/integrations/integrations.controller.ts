import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { IntegrationsService } from './integrations.service';

@ApiTags('admin-integrations')
@Controller('v1/admin/integrations/meta')
export class IntegrationsController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.integrations.getMeta();
  }

  @Post('test')
  async test(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.integrations.testMeta(input, session);
  }

  @Patch()
  async save(@Body() input: unknown, @Req() request: FastifyRequest) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.integrations.saveMeta(input, session);
  }
}
