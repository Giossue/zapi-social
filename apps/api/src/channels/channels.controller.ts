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
import { ChannelsService } from './channels.service'

@ApiTags('portal-channels')
@Controller('v1/portal/channels')
export class ChannelsController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.channels.list(await this.access.requirePortalSession(request), query)
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.channels.create(await this.access.requirePortalSession(request), body)
  }

  @Patch(':id')
  async update(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.channels.update(await this.access.requirePortalSession(request), id, body)
  }

  @Post(':id/pause')
  async pause(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.channels.update(await this.access.requirePortalSession(request), id, {
      status: 'paused',
    })
  }

  @Post(':id/resume')
  async resume(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.channels.update(await this.access.requirePortalSession(request), id, {
      status: 'active',
    })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.channels.remove(await this.access.requirePortalSession(request), id)
  }
}
