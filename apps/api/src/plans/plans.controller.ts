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
import { PlansService } from './plans.service';

@ApiTags('admin-plans')
@Controller('v1/admin/plans')
export class PlansController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly plans: PlansService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.plans.list(query);
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.plans.create(
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
    return this.plans.update(
      await this.access.requirePlatformAdmin(request),
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    await this.plans.remove(
      await this.access.requirePlatformAdmin(request),
      id,
    );
  }
}
