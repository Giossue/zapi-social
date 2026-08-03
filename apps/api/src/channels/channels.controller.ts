import {
  Body,
  Controller,
  NotFoundException,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SessionAccessService } from '../identity/session-access.service';
import { ChannelConnectionsService } from './channel-connections.service';
import { ChannelsService } from './channels.service';
import { ProfileSyncService } from './profile-sync.service';
import { WhatsAppStatusConnectionsService } from './whatsapp-status-connections.service';

@ApiTags('portal-channels-v2')
@Controller('v1/portal/channels')
export class ChannelsController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly connections: ChannelConnectionsService,
    private readonly profileSyncService: ProfileSyncService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.channels.list(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Patch(':id')
  async update(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.channels.updateDisplayName(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.channels.remove(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post(':id/reconnect')
  async reconnect(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.connections.reconnect(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post(':id/profile-sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async profileSync(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.profileSyncService.requestManualSync(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}

@ApiTags('portal-channel-connections-v2')
@Controller('v1/portal/channel-connections')
export class ChannelConnectionsController {
  constructor(
    private readonly connections: ChannelConnectionsService,
    private readonly whatsapp: WhatsAppStatusConnectionsService,
    private readonly access: SessionAccessService,
  ) {}

  @Post('oauth/start')
  async start(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.connections.start(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Post('whatsapp-status/start')
  async startWhatsApp(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.whatsapp.start(
      await this.access.requirePortalSession(request),
      body,
    );
  }

  @Post(':id/refresh-qr')
  async refreshQr(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.whatsapp.refreshQr(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Get(':id/qr')
  async qr(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const qr = await this.whatsapp.qr(
      await this.access.requirePortalSession(request),
      id,
    );
    reply.header(
      'cache-control',
      'no-store, no-cache, must-revalidate, max-age=0',
    );
    reply.header('content-type', qr.contentType);
    return reply.send(qr.body);
  }

  @Get(':id/status')
  async status(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.whatsapp.status(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Get(':id/candidates')
  async candidates(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.connections.candidates(
      await this.access.requirePortalSession(request),
      id,
    );
  }

  @Post(':id/select')
  async select(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.connections.select(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Post(':id/cancel')
  async cancel(@Req() request: FastifyRequest, @Param('id') id: string) {
    const session = await this.access.requirePortalSession(request);
    try {
      return await this.whatsapp.cancel(session, id);
    } catch (error) {
      if (error instanceof NotFoundException)
        return this.connections.cancel(session, id);
      throw error;
    }
  }
}
