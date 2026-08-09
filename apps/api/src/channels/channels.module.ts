import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { TeamsModule } from '../teams/teams.module';
import { ChannelConnectionsService } from './channel-connections.service';
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
    WhatsAppStatusConnectionsService,
    ChannelOAuthService,
    ChannelOAuthAuthorizationService,
    ProfileSyncService,
  ],
})
export class ChannelsModule {}
