import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { AdminOperationsService } from './admin-operations.service';

@ApiTags('admin-operations')
@Controller('v1/admin/operations')
export class AdminOperationsController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly operations: AdminOperationsService,
  ) {}

  @Get(':module')
  async view(
    @Req() request: FastifyRequest,
    @Param('module') module: string,
    @Query() query: unknown,
  ) {
    await this.access.requirePlatformAdmin(request);
    return this.operations.view(module, query);
  }

  @Post(':module')
  async create(
    @Req() request: FastifyRequest,
    @Param('module') module: string,
    @Body() body: unknown,
  ) {
    return this.operations.create(
      await this.access.requirePlatformAdmin(request),
      module,
      body,
    );
  }

  @Post(':module/:tab/:id/actions')
  async action(
    @Req() request: FastifyRequest,
    @Param('module') module: string,
    @Param('tab') tab: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.operations.action(
      await this.access.requirePlatformAdmin(request),
      module,
      tab,
      id,
      body,
    );
  }
}
