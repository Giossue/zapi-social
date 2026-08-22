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
import { AdminManualPaymentsService } from './admin-manual-payments.service';

@ApiTags('admin-manual-payments')
@Controller('v1/admin/manual-payments')
export class AdminManualPaymentsController {
  constructor(
    private readonly payments: AdminManualPaymentsService,
    private readonly access: SessionAccessService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.payments.list(query);
  }

  @Get('options')
  async options(@Req() request: FastifyRequest, @Query() query: unknown) {
    await this.access.requirePlatformAdmin(request);
    return this.payments.options(query);
  }

  @Patch('settings')
  async updateSettings(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.payments.updateSettings(
      await this.access.requirePlatformAdmin(request),
      body,
    );
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.payments.create(
      await this.access.requirePlatformAdmin(request),
      body,
    );
  }

  @Post(':id/approve')
  async approve(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.payments.approve(
      await this.access.requirePlatformAdmin(request),
      id,
    );
  }

  @Post(':id/reject')
  async reject(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.payments.reject(
      await this.access.requirePlatformAdmin(request),
      id,
    );
  }

  @Delete(':id')
  async remove(@Req() request: FastifyRequest, @Param('id') id: string) {
    return this.payments.remove(
      await this.access.requirePlatformAdmin(request),
      id,
    );
  }
}
