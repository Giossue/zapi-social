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
import { IdentityService } from '../identity/identity.service';
import { AppException } from '../platform/errors/app-exception';
import { ChannelsService } from './channels.service';

const sessionCookieName = 'zapi_session';

@ApiTags('portal-channels')
@Controller('v1/portal/channels')
export class ChannelsController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly identity: IdentityService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.channels.list(await this.sessionFor(request), query);
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.channels.create(await this.sessionFor(request), body);
  }

  @Patch(':id')
  async update(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.channels.update(await this.sessionFor(request), id, body);
  }

  @Post(':id/pause')
  async pause(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.channels.update(await this.sessionFor(request), id, {
      status: 'paused',
    });
  }

  @Post(':id/resume')
  async resume(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.channels.update(await this.sessionFor(request), id, {
      status: 'active',
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.channels.remove(await this.sessionFor(request), id);
  }

  private async sessionFor(request: FastifyRequest) {
    const session = await this.identity.getSession(
      request.cookies[sessionCookieName],
    );
    if (!session)
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);
    return session;
  }
}
