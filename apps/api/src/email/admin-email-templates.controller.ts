import { Body, Controller, Delete, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { EmailTemplatesService } from './email-templates.service';

@ApiTags('admin-email-templates')
@Controller('v1/admin/email-templates')
export class AdminEmailTemplatesController {
  constructor(
    private readonly templates: EmailTemplatesService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.templates.list();
  }

  @Patch(':key')
  async update(
    @Req() request: FastifyRequest,
    @Param('key') key: string,
    @Body() body: unknown,
  ) {
    return this.templates.update(
      await this.access.requirePlatformAdmin(request),
      key,
      body,
    );
  }

  @Delete(':key')
  async reset(@Req() request: FastifyRequest, @Param('key') key: string) {
    return this.templates.reset(
      await this.access.requirePlatformAdmin(request),
      key,
    );
  }
}
