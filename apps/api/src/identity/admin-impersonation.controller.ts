import { Controller, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { IdentityService } from './identity.service';
import { SessionAccessService } from './session-access.service';

const accessCookieName = 'zapi_access';
const sessionCookieName = 'zapi_session';

@ApiTags('admin-impersonation')
@Controller('v1/admin/users')
export class AdminImpersonationController {
  constructor(
    private readonly identity: IdentityService,
    private readonly access: SessionAccessService,
    private readonly config: ConfigService,
  ) {}

  @Post(':id/impersonate')
  async impersonate(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.access.requirePlatformAdmin(request);
    const authentication = await this.identity.impersonate(session.user.id, id);
    this.setCookies(
      reply,
      authentication.accessToken,
      authentication.sessionToken,
    );
    return authentication.session;
  }

  private setCookies(
    reply: FastifyReply,
    accessToken: string,
    sessionToken: string,
  ) {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const domain = this.config.get<string>('COOKIE_DOMAIN');
    const options = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure,
      domain,
      path: '/',
    };
    reply.setCookie(accessCookieName, accessToken, options);
    reply.setCookie(sessionCookieName, sessionToken, options);
  }
}
