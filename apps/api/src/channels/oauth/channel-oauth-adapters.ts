import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  channelOAuthCallbackQuerySchema,
  channelOAuthConnectQuerySchema,
  channelOAuthProviderKeySchema,
  type PortalAuthSession,
  type ChannelOAuthCallbackOutcome,
  type ChannelOAuthCallbackQuery,
  type ChannelOAuthConnectQuery,
  type ChannelOAuthProviderKey,
} from '@workspace/contracts';
import {
  IntegrationsService,
  type OAuthProviderConfiguration,
} from '../../integrations/integrations.service';
import { AppException } from '../../platform/errors/app-exception';
import { ChannelOAuthService } from './channel-oauth.service';

type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  state: string;
};

type OAuthProviderAdapter = {
  providerKey: ChannelOAuthProviderKey;
  buildAuthorizationUrl(request: AuthorizationRequest): string;
};

const metaAdapter: OAuthProviderAdapter = {
  providerKey: 'facebook',
  buildAuthorizationUrl({ clientId, redirectUri, state }) {
    return buildUrl('https://www.facebook.com/v22.0/dialog/oauth', {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'pages_show_list,pages_read_engagement,instagram_basic',
      state,
    });
  },
};

const linkedInAdapter: OAuthProviderAdapter = {
  providerKey: 'linkedin',
  buildAuthorizationUrl({ clientId, redirectUri, state }) {
    return buildUrl('https://www.linkedin.com/oauth/v2/authorization', {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email w_member_social r_organization_social',
      state,
    });
  },
};

const adapters = new Map<ChannelOAuthProviderKey, OAuthProviderAdapter>([
  [metaAdapter.providerKey, metaAdapter],
  [linkedInAdapter.providerKey, linkedInAdapter],
]);

export type ChannelOAuthAuthorizationStart = {
  authorizationUrl: string;
};

export type ChannelOAuthCallbackRedirect = {
  redirectUrl: string;
};

@Injectable()
export class ChannelOAuthAuthorizationService {
  constructor(
    private readonly config: ConfigService,
    private readonly integrations: IntegrationsService,
    private readonly oauth: ChannelOAuthService,
  ) {}

  async start(
    session: PortalAuthSession,
    providerKeyInput: string,
    input: unknown,
  ): Promise<ChannelOAuthAuthorizationStart> {
    const providerKey = this.parseProviderKey(providerKeyInput);
    const connect = this.parseConnectInput(input);
    const adapter = this.adapterFor(providerKey);
    const configuration =
      await this.integrations.readOAuthConfiguration(providerKey);
    const state = await this.oauth.start(session, {
      ...connect,
      providerKey,
    });

    return {
      authorizationUrl: adapter.buildAuthorizationUrl({
        clientId: configuration.clientId,
        redirectUri: this.callbackUrl(providerKey),
        state: state.state,
      }),
    };
  }

  async callback(
    providerKeyInput: string,
    input: unknown,
  ): Promise<ChannelOAuthCallbackRedirect> {
    const providerKey = this.parseProviderKey(providerKeyInput);
    const callback = channelOAuthCallbackQuerySchema.safeParse(input);
    if (!callback.success) {
      throw new AppException('OAUTH_CALLBACK_INVALID', HttpStatus.BAD_REQUEST);
    }

    const state = await this.oauth.consume(callback.data.state, providerKey);
    const outcome = this.callbackOutcome(callback.data);

    return {
      redirectUrl: this.portalResultUrl({
        outcome,
        providerKey: state.providerKey,
        capabilityKey: state.capabilityKey,
      }),
    };
  }

  private parseProviderKey(input: string): ChannelOAuthProviderKey {
    const providerKey = channelOAuthProviderKeySchema.safeParse(input);
    if (!providerKey.success) {
      throw new AppException(
        'OAUTH_PROVIDER_UNSUPPORTED',
        HttpStatus.NOT_FOUND,
      );
    }
    return providerKey.data;
  }

  private parseConnectInput(input: unknown): ChannelOAuthConnectQuery {
    const parsed = channelOAuthConnectQuerySchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    return parsed.data;
  }

  private adapterFor(
    providerKey: ChannelOAuthProviderKey,
  ): OAuthProviderAdapter {
    const adapter = adapters.get(providerKey);
    if (!adapter) {
      throw new AppException(
        'OAUTH_PROVIDER_UNSUPPORTED',
        HttpStatus.NOT_FOUND,
      );
    }
    return adapter;
  }

  private callbackUrl(providerKey: ChannelOAuthProviderKey) {
    return new URL(
      `/v1/oauth/channels/${providerKey}/callback`,
      this.config.getOrThrow<string>('API_PUBLIC_ORIGIN'),
    ).toString();
  }

  private portalResultUrl(input: {
    outcome: ChannelOAuthCallbackOutcome;
    providerKey: string;
    capabilityKey: string;
  }) {
    const url = new URL(
      '/portal/channels',
      this.config.getOrThrow<string>('WEB_ORIGIN'),
    );
    url.searchParams.set('oauth', input.outcome);
    url.searchParams.set('provider', input.providerKey);
    url.searchParams.set('capability', input.capabilityKey);
    return url.toString();
  }

  private callbackOutcome(
    input: ChannelOAuthCallbackQuery,
  ): ChannelOAuthCallbackOutcome {
    if (input.error) return 'denied';
    return input.code ? 'authorized' : 'failed';
  }
}

function buildUrl(baseUrl: string, parameters: Record<string, string>) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
