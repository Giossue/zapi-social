import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('admin-dashboard')
@Controller('v1/admin/dashboard')
export class AdminDashboardController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async getDashboard(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.dashboard.getDashboard();
  }
}
