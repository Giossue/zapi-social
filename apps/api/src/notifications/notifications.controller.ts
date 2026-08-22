import { Controller, Get, Param, Post, Req } from '@nestjs/common';
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
  async feed(@Req() request: FastifyRequest) {
    return this.notifications.feed(
      await this.access.requirePortalSession(request),
    );
  }

  @Post('read-all')
  async markAllRead(@Req() request: FastifyRequest) {
    return this.notifications.markAllRead(
      await this.access.requirePortalSession(request),
    );
  }

  @Post('archive-all')
  async archiveAll(@Req() request: FastifyRequest) {
    return this.notifications.archiveAll(
      await this.access.requirePortalSession(request),
    );
  }

  @Post(':id/read')
  async markRead(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.notifications.markRead(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}
