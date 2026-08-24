import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { NotificationsService } from './notifications.service';

@ApiTags('portal-notifications')
@Controller('v1/portal/notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async feed(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.notifications.feed(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Post(':id/read')
  async markRead(@Req() request: FastifyRequest, @Param('id') id: unknown) {
    return this.notifications.markRead(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post(':id/archive')
  async archive(@Req() request: FastifyRequest, @Param('id') id: unknown) {
    return this.notifications.archive(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}
