import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { PortalChannelCapabilityKey } from '@workspace/contracts';
import type {
  ChannelConnectionAdapter,
  ConnectionCandidate,
} from './channel-connection.adapter';

@Injectable()
export class XConnectionAdapter implements ChannelConnectionAdapter {
  readonly providerKey = 'x';
  readonly usesPkce = true;

  scopesFor(): string[] {
    return ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];
  }

  buildAuthorizationUrl({
    clientId,
    redirectUri,
    state,
    scopes,
    codeChallenge,
  }: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: string[];
    codeChallenge?: string;
  }): string {
    const url = new URL('https://x.com/i/oauth2/authorize');
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: scopes.join(' '),
      code_challenge: codeChallenge ?? '',
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  async exchangeCode({
    clientId,
    clientSecret,
    code,
    redirectUri,
    codeVerifier,
  }: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
  }> {
    if (!codeVerifier) throw new ServiceUnavailableException();

    const response = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return this.parseToken(response);
  }

  async fetchCandidates({
    accessToken,
  }: {
    accessToken: string;
    capabilityKey: PortalChannelCapabilityKey;
  }): Promise<ConnectionCandidate[]> {
    const url = new URL('https://api.x.com/2/users/me');
    url.search = new URLSearchParams({
      'user.fields': 'profile_image_url,username,name',
    }).toString();

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body: unknown = await response.json().catch(() => null);
    const data =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>).data
        : null;
    if (!response.ok || typeof data !== 'object' || data === null) {
      throw new ServiceUnavailableException();
    }
    const record = data as Record<string, unknown>;
    const id = this.text(record, 'id');
    const username = this.text(record, 'username');
    if (!id) throw new ServiceUnavailableException();

    return [
      {
        externalId: id,
        displayName: this.text(record, 'name') ?? username ?? id,
        description: 'x_profile',
        publicMetadata: {
          kind: 'x_profile',
          ...(username ? { handle: username } : {}),
        },
        context: {
          accessToken,
          avatarUrl: this.text(record, 'profile_image_url') ?? undefined,
        },
      },
    ];
  }

  private async parseToken(response: Response) {
    const body: unknown = await response.json().catch(() => null);
    const record =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const accessToken = record.access_token;
    if (!response.ok || typeof accessToken !== 'string' || !accessToken) {
      throw new ServiceUnavailableException();
    }
    return {
      accessToken,
      refreshToken:
        typeof record.refresh_token === 'string'
          ? record.refresh_token
          : undefined,
      expiresAt:
        typeof record.expires_in === 'number'
          ? new Date(Date.now() + record.expires_in * 1000).toISOString()
          : undefined,
    };
  }

  private text(body: Record<string, unknown>, key: string): string | null {
    const value = body[key];
    return typeof value === 'string' && value ? value : null;
  }
}
