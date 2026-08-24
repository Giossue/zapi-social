import { Injectable } from '@nestjs/common';
import type {
  ChannelProviderIssue,
  PortalChannelProviderKey,
} from '@workspace/contracts';
import type { ChannelProviderVerifier } from '../channel-provider-verifier';

const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';

const apiVersionPattern = /^\d{6}$/;

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
      return 'provider_unreachable';
    }

    if (response.ok) return null;

    if (response.status === 400 || response.status === 401) {
      return 'invalid_credentials';
    }
    return 'provider_unreachable';
  }
}
