import type {
  ChannelProviderIssue,
  PortalChannelProviderKey,
} from '@workspace/contracts';

export interface ChannelProviderVerifier {
  readonly providerKey: PortalChannelProviderKey;
  verify(values: Record<string, string>): Promise<ChannelProviderIssue | null>;
}

export const CHANNEL_PROVIDER_VERIFIERS = Symbol('CHANNEL_PROVIDER_VERIFIERS');
