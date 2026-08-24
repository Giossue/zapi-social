import { Injectable } from '@nestjs/common';
import type {
  ChannelProviderIssue,
  PortalChannelProviderKey,
} from '@workspace/contracts';
import type { ChannelProviderVerifier } from '../channel-provider-verifier';

const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';

/** `Linkedin-Version` va en formato `YYYYMM` y no admite versión por defecto. */
const apiVersionPattern = /^\d{6}$/;

/**
 * Comprueba las credenciales de LinkedIn pidiendo un token con
 * `client_credentials`. No necesita que nadie autorice nada: si el par
 * cliente/secreto no es válido, LinkedIn responde `invalid_client`.
 */
@Injectable()
export class LinkedInProviderVerifier implements ChannelProviderVerifier {
  readonly providerKey: PortalChannelProviderKey = 'linkedin';

  async verify(
    values: Record<string, string>,
  ): Promise<ChannelProviderIssue | null> {
    const clientId = values.clientId?.trim();
    const clientSecret = values.clientSecret?.trim();
    const apiVersion = values.apiVersion?.trim();

    if (
      !clientId ||
      !clientSecret ||
      !apiVersionPattern.test(apiVersion ?? '')
    ) {
      return 'configuration_required';
    }

    let response: Response;
    try {
      response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Ni salió la petición: no se puede decir que las credenciales fallen.
      return 'provider_unreachable';
    }

    if (response.ok) return null;

    // LinkedIn responde 400 con `invalid_client` cuando el par no vale, y 401
    // cuando el cliente existe pero el secreto no coincide. Lo demás es suyo.
    if (response.status === 400 || response.status === 401) {
      return 'invalid_credentials';
    }
    return 'provider_unreachable';
  }
}
