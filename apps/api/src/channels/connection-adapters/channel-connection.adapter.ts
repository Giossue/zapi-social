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

/**
 * Lo que cambia de una red a otra al conectar una cuenta. El resto —la sesión,
 * la tabla de candidatos, la selección y el guardado— ya es común, así que vive
 * en `ChannelConnectionsService`.
 */
export interface ChannelConnectionAdapter {
  readonly providerKey: string;
  scopesFor(capabilityKey: PortalChannelCapabilityKey): string[];
  /** PKCE cuando el proveedor lo exige (X); LinkedIn no lo usa. */
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

/** Resuelve el adaptador de conexión de un proveedor. */
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
