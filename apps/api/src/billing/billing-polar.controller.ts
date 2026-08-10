import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { BillingPolarService } from './billing-polar.service';

@ApiTags('admin-billing')
@Controller('v1/admin/integrations/polar')
export class BillingPolarController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly polar: BillingPolarService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.polar.get();
  }

  @Patch()
  async save(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.polar.save(
      body,
      await this.access.requirePlatformAdmin(request),
    );
  }
}
