import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { PortalBillingService } from './portal-billing.service';

@ApiTags('portal-billing')
@Controller('v1/portal/billing')
export class PortalBillingController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly billing: PortalBillingService,
  ) {}

  @Get('plans')
  async plans(@Req() request: FastifyRequest) {
    return this.billing.plans(
      await this.access.requirePortalSession(request),
    );
  }

  @Post('checkout')
  async checkout(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.billing.checkout(
      await this.access.requirePortalSession(request),
      body,
    );
  }
}
