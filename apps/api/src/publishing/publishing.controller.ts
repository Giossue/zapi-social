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
import { PublishingService } from './publishing.service';

@ApiTags('portal-publishing-v2')
@Controller('v1/portal/publishing')
export class PublishingController {
  constructor(
    private readonly publishing: PublishingService,
    private readonly access: SessionAccessService,
  ) {}

  @Get() async list(@Req() request: FastifyRequest) {
    return this.publishing.list(
      await this.access.requirePortalSession(request),
    );
  }
  @Post() async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.publishing.create(
      await this.access.requirePortalSession(request),
      body,
    );
  }
  @Patch(':id') async update(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.publishing.update(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) async remove(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    await this.publishing.remove(
      await this.access.requirePortalSession(request),
      id,
    );
  }
  @Post(':id/retry') async retry(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    return this.publishing.retry(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}
