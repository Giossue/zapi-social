import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { AdminAiService } from './admin-ai.service';

@ApiTags('admin-ai')
@Controller('v1/admin/ai')
export class AdminAiController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly ai: AdminAiService,
  ) {}

  @Get('configuration')
  async configuration(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.ai.configuration();
  }

  @Post('providers/:providerKey/test')
  async testProvider(
    @Req() request: FastifyRequest,
    @Param('providerKey') providerKey: string,
    @Body() input: unknown,
  ) {
    return this.ai.testProvider(
      providerKey,
      input,
      await this.access.requirePlatformAdmin(request),
    );
  }

  @Patch('providers/:providerKey')
  async updateProvider(
    @Req() request: FastifyRequest,
    @Param('providerKey') providerKey: string,
    @Body() input: unknown,
  ) {
    return this.ai.updateProvider(
      providerKey,
      input,
      await this.access.requirePlatformAdmin(request),
    );
  }

  @Post('models')
  async createModel(@Req() request: FastifyRequest, @Body() input: unknown) {
    return this.ai.createModel(
      input,
      await this.access.requirePlatformAdmin(request),
    );
  }

  @Patch('models/:id')
  async updateModel(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.ai.updateModel(
      id,
      input,
      await this.access.requirePlatformAdmin(request),
    );
  }

  @Patch('routes/:kind')
  async updateRoute(
    @Req() request: FastifyRequest,
    @Param('kind') kind: string,
    @Body() input: unknown,
  ) {
    return this.ai.updateRoute(
      kind,
      input,
      await this.access.requirePlatformAdmin(request),
    );
  }

  @Get('usage')
  async usage(@Req() request: FastifyRequest, @Query('days') days: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.ai.usage(days);
  }

  @Get('requests')
  async requests(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.ai.requests(query);
  }

  @Get('report')
  async report(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.ai.report(query);
  }
}
