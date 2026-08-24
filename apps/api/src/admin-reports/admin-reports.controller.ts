import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { AdminReportsService } from './admin-reports.service';

@ApiTags('admin-user-report')
@Controller('v1/admin/user-report')
export class AdminUserReportController {
  constructor(
    private readonly reports: AdminReportsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async report(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.reports.userReport();
  }
}

@ApiTags('admin-teams')
@Controller('v1/admin/teams')
export class AdminTeamsController {
  constructor(
    private readonly reports: AdminReportsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async teams(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.reports.teams(query);
  }

  @Patch(':id/modules')
  async updateModules(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    const session = await this.access.requirePlatformAdmin(request);
    return this.reports.updateTeamModules(id, input, session.user.id);
  }
}
