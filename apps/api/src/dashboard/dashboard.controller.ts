import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { DashboardService } from './dashboard.service';

@ApiTags('portal-dashboard')
@Controller('v1/portal/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async getDashboard(@Req() request: FastifyRequest) {
    return this.dashboard.getDashboard(
      await this.access.requirePortalSession(request),
    );
  }
}
