import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyRequest } from 'fastify'
import { SessionAccessService } from '../identity/session-access.service'
import { IntegrationsService } from './integrations.service'

@ApiTags('admin-integrations')
@Controller('v1/admin/integrations')
export class IntegrationsController {
  constructor(
    private readonly access: SessionAccessService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    await this.access.requirePlatformAdmin(request)
    return this.integrations.list()
  }

  @Patch(':providerKey')
  async update(
    @Param('providerKey') providerKey: string,
    @Body() input: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = await this.access.requirePlatformAdmin(request)
    return this.integrations.update(providerKey, input, session)
  }
}
