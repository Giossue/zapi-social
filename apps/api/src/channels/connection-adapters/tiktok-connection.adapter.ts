import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { PortalChannelCapabilityKey } from '@workspace/contracts';
import type {
  ChannelConnectionAdapter,
  ConnectionCandidate,
} from './channel-connection.adapter';

@Injectable()
export class TikTokConnectionAdapter implements ChannelConnectionAdapter {
  readonly providerKey = 'tiktok';

  scopesFor(): string[] {
    return ['user.info.basic', 'video.publish'];
  }

  buildAuthorizationUrl({
    clientId,
    redirectUri,
    state,
    scopes,
  }: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: string[];
  }): string {
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.search = new URLSearchParams({
      client_key: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
      scope: scopes.join(','),
    }).toString();
    return url.toString();
  }

  async exchangeCode({
    clientId,
    clientSecret,
    code,
    redirectUri,
  }: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
  }> {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/oauth/token/',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
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

  async fetchCandidates({
    accessToken,
  }: {
    accessToken: string;
    capabilityKey: PortalChannelCapabilityKey;
  }): Promise<ConnectionCandidate[]> {
    const url = new URL('https://open.tiktokapis.com/v2/user/info/');
    url.search = new URLSearchParams({
      fields: 'open_id,display_name,avatar_url',
    }).toString();

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body: unknown = await response.json().catch(() => null);
    const user =
      typeof body === 'object' && body !== null
        ? ((body as Record<string, unknown>).data as
            Record<string, unknown> | undefined)
        : undefined;
    const record =
      user && typeof user.user === 'object' && user.user !== null
        ? (user.user as Record<string, unknown>)
        : {};
    const id = this.text(record, 'open_id');
    if (!response.ok || !id) throw new ServiceUnavailableException();

    return [
      {
        externalId: id,
        displayName: this.text(record, 'display_name') ?? id,
        description: 'tiktok_profile',
        publicMetadata: { kind: 'tiktok_profile' },
        context: {
          accessToken,
          avatarUrl: this.text(record, 'avatar_url') ?? undefined,
        },
      },
    ];
  }

  private text(body: Record<string, unknown>, key: string): string | null {
    const value = body[key];
    return typeof value === 'string' && value ? value : null;
  }
}
