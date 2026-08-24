import { Injectable } from '@nestjs/common';
import type {
  ChannelProviderIssue,
  PortalChannelProviderKey,
} from '@workspace/contracts';
import type { ChannelProviderVerifier } from '../channel-provider-verifier';

/**
 * Comprueba las credenciales de TikTok pidiendo un token de cliente. TikTok
 * devuelve el error dentro del cuerpo aunque el HTTP sea 200, así que hay que
 * mirar `error`, no solo el estado.
 */
@Injectable()
export class TikTokProviderVerifier implements ChannelProviderVerifier {
  readonly providerKey: PortalChannelProviderKey = 'tiktok';

  async verify(
    values: Record<string, string>,
  ): Promise<ChannelProviderIssue | null> {
    const clientKey = values.clientKey?.trim();
    const clientSecret = values.clientSecret?.trim();
    if (!clientKey || !clientSecret) return 'configuration_required';

    let response: Response;
    try {
      response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return 'provider_unreachable';
    }

    const body: unknown = await response.json().catch(() => null);
    const record =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};
    if (response.ok && typeof record.access_token === 'string') return null;

    // TikTok pone el motivo en `error` incluso con HTTP 200.
    const error = typeof record.error === 'string' ? record.error : '';
    if (
      response.status === 400 ||
      response.status === 401 ||
      error === 'invalid_client'
    ) {
      return 'invalid_credentials';
    }
    return 'provider_unreachable';
  }
}
