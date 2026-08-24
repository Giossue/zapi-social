import { Inject, Injectable } from '@nestjs/common';
import type { PortalChannelCapabilityKey } from '@workspace/contracts';

export type ConnectionCandidate = {
  externalId: string;
  displayName: string;
  description: string;
  publicMetadata: Record<string, string>;
  context: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
    avatarUrl?: string;
  };
};

export interface ChannelConnectionAdapter {
  readonly providerKey: string;
  scopesFor(capabilityKey: PortalChannelCapabilityKey): string[];
  usesPkce?: boolean;
  buildAuthorizationUrl(input: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: string[];
    codeChallenge?: string;
  }): string;
  exchangeCode(input: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
  }>;
  fetchCandidates(input: {
    accessToken: string;
    capabilityKey: PortalChannelCapabilityKey;
    apiVersion?: string;
  }): Promise<ConnectionCandidate[]>;
}

export const CHANNEL_CONNECTION_ADAPTERS = Symbol(
  'CHANNEL_CONNECTION_ADAPTERS',
);

@Injectable()
export class ChannelConnectionAdapterRegistry {
  private readonly byProvider: Map<string, ChannelConnectionAdapter>;

  constructor(
    @Inject(CHANNEL_CONNECTION_ADAPTERS)
    adapters: readonly ChannelConnectionAdapter[],
  ) {
    this.byProvider = new Map(
      adapters.map((adapter) => [adapter.providerKey, adapter]),
    );
  }

  find(providerKey: string): ChannelConnectionAdapter | undefined {
    return this.byProvider.get(providerKey);
  }
}
