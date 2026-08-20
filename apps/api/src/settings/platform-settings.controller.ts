import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { PlatformSettingsService } from './platform-settings.service';

/** Ajustes globales, caché y tareas programadas. Solo administradores. */
@ApiTags('admin-settings')
@Controller('v1/admin/settings')
export class PlatformSettingsController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly settings: PlatformSettingsService,
  ) {}

  @Get('cache')
  async cache(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.settings.cacheState();
  }

  @Post('cache/purge')
  async purgeCache(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.settings.purgeCache();
  }

  @Get('scheduled-jobs')
  async scheduledJobs(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.settings.scheduledJobs();
  }

  @Get(':group')
  async group(@Req() request: FastifyRequest, @Param('group') group: string) {
    await this.access.requirePlatformAdmin(request);
    return this.settings.get(group);
  }

  @Patch(':group')
  async updateGroup(
    @Req() request: FastifyRequest,
    @Param('group') group: string,
    @Body() body: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.settings.save(group, body);
  }
}
