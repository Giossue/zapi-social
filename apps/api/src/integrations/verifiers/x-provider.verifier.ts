import { Injectable } from '@nestjs/common';
import type {
  ChannelProviderIssue,
  PortalChannelProviderKey,
} from '@workspace/contracts';
import type { ChannelProviderVerifier } from '../channel-provider-verifier';

/**
 * Comprueba las credenciales de X pidiendo un token de aplicación con
 * `client_credentials` y Basic Auth. No necesita que nadie autorice: si el par
 * no vale, X responde 401.
 */
@Injectable()
export class XProviderVerifier implements ChannelProviderVerifier {
  readonly providerKey: PortalChannelProviderKey = 'x';

  async verify(
    values: Record<string, string>,
  ): Promise<ChannelProviderIssue | null> {
    const clientId = values.clientId?.trim();
    const clientSecret = values.clientSecret?.trim();
    if (!clientId || !clientSecret) return 'configuration_required';

    let response: Response;
    try {
      response = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return 'provider_unreachable';
    }

    if (response.ok) return null;
    if (response.status === 400 || response.status === 401) {
      return 'invalid_credentials';
    }
    return 'provider_unreachable';
  }
}
