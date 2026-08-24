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
import { AdminRolesService } from './admin-roles.service';

@ApiTags('admin-user-roles')
@Controller('v1/admin/user-roles')
export class AdminRolesController {
  constructor(
    private readonly roles: AdminRolesService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request);
    return this.roles.list();
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.roles.create(
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
    return this.roles.update(
      await this.access.requirePlatformAdmin(request),
      id,
      body,
    );
  }

  @Delete(':id')
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.roles.remove(
      await this.access.requirePlatformAdmin(request),
      id,
    );
  }

  @Get(':id/members')
  async members(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.access.requirePlatformAdmin(request);
    return this.roles.members(id);
  }

  @Get('candidates/search')
  async candidates(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.roles.candidates(query);
  }

  @Post(':id/members')
  async assign(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.roles.assign(
      await this.access.requirePlatformAdmin(request),
      id,
      body,
    );
  }

  @Delete(':id/members/:userId')
  async unassign(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.roles.unassign(
      await this.access.requirePlatformAdmin(request),
      id,
      userId,
    );
  }
}
