import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { SessionAccessService } from '../../identity/session-access.service'
import { ChannelOAuthAuthorizationService } from './channel-oauth-adapters'
import { ChannelOAuthService } from './channel-oauth.service'

@ApiTags('portal-channel-oauth')
@Controller('v1/portal/channels/oauth')
export class ChannelOAuthController {
  constructor(
    private readonly oauth: ChannelOAuthService,
    private readonly access: SessionAccessService,
  ) {}

  @Post('start')
  async start(@Req() request: FastifyRequest, @Body() body: unknown) {
    return this.oauth.start(await this.access.requirePortalSession(request), body)
  }

  @Get('states/:state')
  async status(@Req() request: FastifyRequest, @Param('state') state: string) {
    return this.oauth.status(await this.access.requirePortalSession(request), state)
  }
}

@ApiTags('portal-channel-oauth')
@Controller('v1/portal/channels')
export class ChannelOAuthRedirectController {
  constructor(
    private readonly authorization: ChannelOAuthAuthorizationService,
    private readonly access: SessionAccessService,
  ) {}

  @Get(':provider/connect')
  async connect(
    @Req() request: FastifyRequest,
    @Res() response: FastifyReply,
    @Param('provider') provider: string,
    @Query() query: unknown,
  ) {
    const result = await this.authorization.start(
      await this.access.requirePortalSession(request),
      provider,
      query,
    )
    return response.redirect(result.authorizationUrl, HttpStatus.FOUND)
  }
}

@ApiTags('oauth-callbacks')
@Controller('v1/oauth/channels')
export class ChannelOAuthCallbackController {
  constructor(
    private readonly authorization: ChannelOAuthAuthorizationService,
  ) {}

  @Get(':provider/callback')
  async callback(
    @Res() response: FastifyReply,
    @Param('provider') provider: string,
    @Query() query: unknown,
  ) {
    const result = await this.authorization.callback(provider, query)
    return response.redirect(result.redirectUrl, HttpStatus.FOUND)
  }
}
