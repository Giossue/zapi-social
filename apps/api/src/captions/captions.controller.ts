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
import { CaptionsService } from './captions.service';

@ApiTags('portal-captions')
@Controller('v1/portal/captions')
export class CaptionsController {
  constructor(
    private readonly captions: CaptionsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.captions.list(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.captions.create(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Patch(':id')
  async update(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.captions.update(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.captions.remove(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}
