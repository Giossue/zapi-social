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
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyRequest } from 'fastify'
import { SessionAccessService } from '../identity/session-access.service'
import { ChannelConnectionsService } from './channel-connections.service'
import { ChannelsService } from './channels.service'

@ApiTags('portal-channels-v2')
@Controller('v1/portal/channels')
export class ChannelsController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly connections: ChannelConnectionsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.channels.list(await this.access.requirePortalSession(request), query)
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
    )
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.channels.remove(await this.access.requirePortalSession(request), id)
  }

  @Post(':id/reconnect')
  async reconnect(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.connections.reconnect(await this.access.requirePortalSession(request), id)
  }
}

@ApiTags('portal-channel-connections-v2')
@Controller('v1/portal/channel-connections')
export class ChannelConnectionsController {
  constructor(
    private readonly connections: ChannelConnectionsService,
    private readonly access: SessionAccessService,
  ) {}

  @Post('oauth/start')
  async start(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.connections.start(await this.access.requirePortalSession(request), body)
  }

  @Get(':id/candidates')
  async candidates(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.connections.candidates(await this.access.requirePortalSession(request), id)
  }

  @Post(':id/select')
  async select(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.connections.select(await this.access.requirePortalSession(request), id, body)
  }

  @Post(':id/cancel')
  async cancel(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.connections.cancel(await this.access.requirePortalSession(request), id)
  }
}
