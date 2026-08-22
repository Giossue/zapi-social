import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { AdminPaymentReportService } from './admin-payment-report.service';

@ApiTags('admin-payment-report')
@Controller('v1/admin/payment-report')
export class AdminPaymentReportController {
  constructor(
    private readonly report: AdminPaymentReportService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.report.report(query);
  }
}
