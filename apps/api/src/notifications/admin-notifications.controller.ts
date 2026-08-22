import {
  Body,
  Controller,
  Delete,
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
import { AdminNotificationsService } from './admin-notifications.service';

@ApiTags('admin-notifications')
@Controller('v1/admin/notifications')
export class AdminNotificationsController {
  constructor(
    private readonly notifications: AdminNotificationsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.notifications.list(query);
  }

  @Get('targets')
  async targets(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.notifications.targets(query);
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.notifications.create(
      await this.access.requirePlatformAdmin(request),
      body,
    );
  }

  @Patch(':id')
  async update(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.notifications.update(
      await this.access.requirePlatformAdmin(request),
      id,
      body,
    );
  }

  @Delete(':id')
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.notifications.remove(
      await this.access.requirePlatformAdmin(request),
      id,
    );
  }
}
