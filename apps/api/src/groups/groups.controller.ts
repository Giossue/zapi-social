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
import { GroupsService } from './groups.service';

@ApiTags('portal-groups')
@Controller('v1/portal/groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.groups.list(
      await this.access.requirePortalSession(request),
      query,
    );
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.groups.create(
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
    return this.groups.update(
      await this.access.requirePortalSession(request),
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.groups.remove(
      await this.access.requirePortalSession(request),
      id,
    );
  }
}
