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
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { AiService } from './ai.service';

@ApiTags('portal-ai')
@Controller('v1/portal/ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly access: SessionAccessService,
  ) {}

  @Get('requests')
  async listRequests(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.ai.listRequests(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Post('requests')
  async createRequest(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.ai.createRequest(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Get('requests/:id')
  async getRequest(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.ai.getRequest(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post('requests/:id/cancel')
  async cancelRequest(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.ai.cancelRequest(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post('requests/:id/use-as-draft')
  async useAsDraft(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.ai.useAsDraft(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Get('settings')
  async getSettings(@Req() request: FastifyRequest) {
    return this.ai.getSettings(await this.access.requirePortalSession(request));
  }

  @Patch('settings')
  async updateSettings(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.ai.updateSettings(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Get('credits')
  async credits(@Req() request: FastifyRequest) {
    return this.ai.credits(await this.access.requirePortalSession(request));
  }

  @Get('publishing-schedules')
  async listSchedules(@Req() request: FastifyRequest) {
    return this.ai.listSchedules(
      await this.access.requirePortalSession(request),
    );
  }

  @Post('publishing-schedules')
  async createSchedule(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.ai.createSchedule(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Patch('publishing-schedules/:id')
  async updateSchedule(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.ai.updateSchedule(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Post('publishing-schedules/:id/run')
  async runSchedule(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.ai.runSchedule(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Delete('publishing-schedules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSchedule(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.ai.deleteSchedule(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}
