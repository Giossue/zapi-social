import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { IdentityService } from './identity.service'

const accessCookieName = 'zapi_access'
const sessionCookieName = 'zapi_session'

@ApiTags('auth')
@Controller('v1/auth')
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const authentication = await this.identity.register(body)
    this.setAuthenticationCookies(reply, authentication.accessToken, authentication.sessionToken)
    return authentication.session
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const authentication = await this.identity.login(body)
    this.setAuthenticationCookies(reply, authentication.accessToken, authentication.sessionToken)
    return authentication.session
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.identity.logout(request.cookies[sessionCookieName])
    this.clearAuthenticationCookies(reply)
  }

  @Get('session')
  async session(@Req() request: FastifyRequest) {
    const session = await this.identity.getSession(request.cookies[sessionCookieName])
    if (!session) throw new UnauthorizedException('Session expired')
    return session
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const authentication = await this.identity.refresh(request.cookies[sessionCookieName])
    this.setAuthenticationCookies(reply, authentication.accessToken, authentication.sessionToken)
    return authentication.session
  }

  private setAuthenticationCookies(reply: FastifyReply, accessToken: string, sessionToken: string) {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true'

    reply.setCookie(accessCookieName, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 15,
    })
    reply.setCookie(sessionCookieName, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  private clearAuthenticationCookies(reply: FastifyReply) {
    reply.clearCookie(accessCookieName, { path: '/' })
    reply.clearCookie(sessionCookieName, { path: '/' })
  }
}
