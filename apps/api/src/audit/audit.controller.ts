import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { webAuditEventSchema } from '@workspace/contracts';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { AuditService } from './audit.service';

@ApiTags('portal-audit')
@Controller('v1/portal/audit')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly access: SessionAccessService,
  ) {}

  @Post('web-events')
  @HttpCode(HttpStatus.NO_CONTENT)
  async createWebEvent(@Req() request: FastifyRequest, @Body() body: unknown) {
    await this.audit.logWebEvent(
      await this.access.requirePortalSession(request),
      webAuditEventSchema.parse(body),
    );
  }
}

@ApiTags('admin-audit')
@Controller('v1/admin/audit-events')
export class AdminAuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.audit.listAdminEvents();
  }
}
