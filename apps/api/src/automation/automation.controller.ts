import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { AutomationService } from './automation.service';

@ApiTags('portal-automation')
@Controller('v1/portal/automation')
export class AutomationPortalController {
  constructor(
    private readonly automation: AutomationService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async get(@Req() request: FastifyRequest) {
    return this.automation.getPortal(
      await this.access.requirePortalSession(request),
    );
  }

  @Post('api-keys')
  async createApiKey(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.automation.createApiKey(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Delete('api-keys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeApiKey(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.automation.revokeApiKey(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post('webhooks')
  async createWebhook(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.automation.createWebhook(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Patch('webhooks/:id')
  async updateWebhook(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.automation.updateWebhook(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Delete('webhooks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeWebhook(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.automation.removeWebhook(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}

@ApiTags('automation-api')
@Controller('v1/automation')
export class AutomationExternalController {
  constructor(private readonly automation: AutomationService) {}

  @Get('me')
  me(@Req() request: FastifyRequest) {
    return this.automation.externalIdentity(request);
  }

  @Get('accounts')
  accounts(@Req() request: FastifyRequest) {
    return this.automation.externalAccounts(request);
  }

  @Get('posts')
  posts(@Req() request: FastifyRequest) {
    return this.automation.externalPosts(request);
  }

  @Post('posts')
  createPosts(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.automation.externalCreatePosts(request, body);
  }
}
