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
import { RssSchedulesService } from './rss-schedules.service';

@ApiTags('portal-rss-schedules-v2')
@Controller('v1/portal/rss-schedules')
export class RssSchedulesController {
  constructor(
    private readonly schedules: RssSchedulesService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.schedules.list(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.schedules.create(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Post('validate-feed')
  async validateFeed(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.schedules.validateFeed(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Get(':id')
  async get(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.schedules.get(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Patch(':id')
  async update(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.schedules.update(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Post(':id/toggle')
  async toggle(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.schedules.toggle(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post(':id/run')
  async run(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.schedules.run(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.schedules.remove(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Get(':id/history')
  async history(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Query() query: unknown,
  ) {
    return this.schedules.history(
      await this.access.requirePortalSession(request),
      id,
      query,
    );
  }

  @Get(':id/runs')
  async runs(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Query() query: unknown,
  ) {
    return this.schedules.runs(
      await this.access.requirePortalSession(request),
      id,
      query,
    );
  }
}
