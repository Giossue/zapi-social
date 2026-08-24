import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { PortalPlanChangesService } from './portal-plan-changes.service';

@ApiTags('portal-billing')
@Controller('v1/portal/billing/plan-change')
export class PortalPlanChangesController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly changes: PortalPlanChangesService,
  ) {}

  @Get()
  async state(@Req() request: FastifyRequest) {
    return this.changes.state(await this.access.requirePortalSession(request));
  }

  @Post()
  async schedule(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.changes.schedule(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Req() request: FastifyRequest) {
    await this.changes.cancel(await this.access.requirePortalSession(request));
  }
}
