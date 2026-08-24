import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PlanAccessModule } from '../plans/plan-access.module';
import { TeamsModule } from '../teams/teams.module';
import { ChannelConnectionsService } from './channel-connections.service';
import {
  CHANNEL_CONNECTION_ADAPTERS,
  ChannelConnectionAdapterRegistry,
} from './connection-adapters/channel-connection.adapter';
import { LinkedInConnectionAdapter } from './connection-adapters/linkedin-connection.adapter';
import { TikTokConnectionAdapter } from './connection-adapters/tiktok-connection.adapter';
import { XConnectionAdapter } from './connection-adapters/x-connection.adapter';
import {
  ChannelConnectionsController,
  ChannelsController,
} from './channels.controller';
import { ChannelsService } from './channels.service';
import { ChannelOAuthAuthorizationService } from './oauth/channel-oauth-adapters';
import {
  ChannelOAuthCallbackController,
  ChannelOAuthController,
  ChannelOAuthRedirectController,
} from './oauth/channel-oauth.controller';
import { ChannelOAuthService } from './oauth/channel-oauth.service';
import { ProfileSyncService } from './profile-sync.service';
import { WhatsAppStatusConnectionsService } from './whatsapp-status-connections.service';

const META_PROFILE_SYNC_QUEUE = 'meta-profile-sync';
const WHATSAPP_PROFILE_SYNC_QUEUE = 'whatsapp-profile-sync';

@Module({
  imports: [
    IdentityModule,
    IntegrationsModule,
    PlanAccessModule,
    TeamsModule,
    BullModule.registerQueue(
      { name: META_PROFILE_SYNC_QUEUE },
      { name: WHATSAPP_PROFILE_SYNC_QUEUE },
    ),
  ],
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
    LinkedInConnectionAdapter,
    XConnectionAdapter,
    TikTokConnectionAdapter,
    ChannelConnectionAdapterRegistry,
    {
      provide: CHANNEL_CONNECTION_ADAPTERS,
      inject: [
        LinkedInConnectionAdapter,
        XConnectionAdapter,
        TikTokConnectionAdapter,
      ],
      useFactory: (
        linkedin: LinkedInConnectionAdapter,
        x: XConnectionAdapter,
        tiktok: TikTokConnectionAdapter,
      ) => [linkedin, x, tiktok],
    },
    WhatsAppStatusConnectionsService,
    ChannelOAuthService,
    ChannelOAuthAuthorizationService,
    ProfileSyncService,
  ],
})
export class ChannelsModule {}
