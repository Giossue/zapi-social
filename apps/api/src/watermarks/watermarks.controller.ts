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
import { WatermarksService } from './watermarks.service';

@ApiTags('portal-watermarks')
@Controller('v1/portal/watermarks')
export class WatermarksController {
  constructor(
    private readonly watermarks: WatermarksService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    return this.watermarks.list(
      await this.access.requirePortalSession(request),
    );
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.watermarks.create(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Get(':id')
  async get(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.watermarks.get(
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
    return this.watermarks.update(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.watermarks.remove(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}
