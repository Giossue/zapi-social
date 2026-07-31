import { HttpStatus, Injectable } from '@nestjs/common'
import type { PortalAuthSession, PlatformAdminAuthSession } from '@workspace/contracts'
import type { FastifyRequest } from 'fastify'
import { AppException } from '../platform/errors/app-exception'
import { IdentityService } from './identity.service'

const sessionCookieName = 'zapi_session'

@Injectable()
export class SessionAccessService {
  constructor(private readonly identity: IdentityService) {}

  async requirePlatformAdmin(
    request: FastifyRequest,
  ): Promise<PlatformAdminAuthSession> {
    const session = await this.requireSession(request)
    if (session.area !== 'admin') {
      throw new AppException('AUTH_ADMIN_ACCESS_REQUIRED', HttpStatus.FORBIDDEN)
    }
    return session
  }

  async requirePortalSession(
    request: FastifyRequest,
  ): Promise<PortalAuthSession> {
    const session = await this.requireSession(request)
    if (session.area !== 'portal') {
      throw new AppException('AUTH_PORTAL_ACCESS_REQUIRED', HttpStatus.FORBIDDEN)
    }
    return session
  }

  private async requireSession(request: FastifyRequest) {
    const session = await this.identity.getSession(
      request.cookies[sessionCookieName],
    )
    if (!session) {
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED)
    }
    return session
  }
}
