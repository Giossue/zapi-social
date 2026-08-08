import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { AffiliateService } from './affiliate.service';

@ApiTags('portal-affiliate')
@Controller('v1/portal/affiliate')
export class AffiliatePortalController {
  constructor(
    private readonly affiliate: AffiliateService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async dashboard(@Req() request: FastifyRequest) {
    return this.affiliate.dashboard(
      await this.access.requirePortalSession(request),
    );
  }

  @Post('activate')
  async activate(@Req() request: FastifyRequest) {
    return this.affiliate.activate(
      await this.access.requirePortalSession(request),
    );
  }

  @Post('withdrawals')
  async requestWithdrawal(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.affiliate.requestWithdrawal(
      await this.access.requirePortalSession(request),
      body,
    );
  }
}

@ApiTags('public-affiliate')
@Controller('v1/public/affiliate')
export class AffiliatePublicController {
  constructor(private readonly affiliate: AffiliateService) {}

  @Post('referrals')
  capture(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.affiliate.capture(request, body);
  }
}
