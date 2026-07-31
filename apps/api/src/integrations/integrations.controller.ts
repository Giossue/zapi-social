import { Body, Controller, Get, HttpStatus, Param, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { IdentityService } from '../identity/identity.service';
import { AppException } from '../platform/errors/app-exception';
import { IntegrationsService } from './integrations.service';

const sessionCookieName = 'zapi_session';

@ApiTags('admin-integrations')
@Controller('v1/admin/integrations')
export class IntegrationsController {
  constructor(
    private readonly identity: IdentityService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    await this.requireAdminSession(request);
    return this.integrations.list();
  }

  @Patch(':providerKey')
  async update(
    @Param('providerKey') providerKey: string,
    @Body() input: unknown,
    @Req() request: FastifyRequest,
  ) {
    const session = await this.requireAdminSession(request);
    return this.integrations.update(providerKey, input, session);
  }

  private async requireAdminSession(request: FastifyRequest) {
    const session = await this.identity.getSession(
      request.cookies[sessionCookieName],
    );
    if (!session) {
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);
    }

    if (session.workspace.role !== 'owner') {
      throw new AppException(
        'AUTH_WORKSPACE_UNAVAILABLE',
        HttpStatus.FORBIDDEN,
      );
    }

    return session;
  }
}
