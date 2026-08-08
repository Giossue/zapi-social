import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { BulkPostsService } from './bulk-posts.service';

@ApiTags('portal-bulk-posts')
@Controller('v1/portal/bulk-posts')
export class BulkPostsController {
  constructor(
    private readonly bulkPosts: BulkPostsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.bulkPosts.list(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.bulkPosts.create(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Get(':id')
  async get(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Query() query: unknown,
  ) {
    return this.bulkPosts.get(
      await this.access.requirePortalSession(request),
      id,
      query,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.bulkPosts.cancel(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}
