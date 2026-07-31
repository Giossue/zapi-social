import { Controller, Get, HttpStatus, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyRequest } from 'fastify'
import { IdentityService } from '../identity/identity.service'
import { AppException } from '../platform/errors/app-exception'
import { DashboardService } from './dashboard.service'

const sessionCookieName = 'zapi_session'

@ApiTags('portal-dashboard')
@Controller('v1/portal/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly identity: IdentityService,
  ) {}

  @Get()
  async getDashboard(@Req() request: FastifyRequest) {
    const session = await this.identity.getSession(request.cookies[sessionCookieName])
    if (!session) {
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED)
    }

    return this.dashboard.getDashboard(session)
  }
}
