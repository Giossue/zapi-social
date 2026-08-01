import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { IntegrationsModule } from '../integrations/integrations.module'
import { ChannelConnectionsService } from './channel-connections.service'
import { ChannelConnectionsController, ChannelsController } from './channels.controller'
import {
  ChannelOAuthCallbackController,
  ChannelOAuthController,
  ChannelOAuthRedirectController,
} from './oauth/channel-oauth.controller'
import { ChannelOAuthAuthorizationService } from './oauth/channel-oauth-adapters'
import { ChannelOAuthService } from './oauth/channel-oauth.service'
import { ChannelsService } from './channels.service'

@Module({
  imports: [IdentityModule, IntegrationsModule],
  controllers: [
    ChannelsController,
    ChannelConnectionsController,
    ChannelOAuthController,
    ChannelOAuthRedirectController,
    ChannelOAuthCallbackController,
  ],
  providers: [
    ChannelsService,
    ChannelConnectionsService,
    ChannelOAuthService,
    ChannelOAuthAuthorizationService,
  ],
})
export class ChannelsModule {}
