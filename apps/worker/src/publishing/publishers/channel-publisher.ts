import type { PortalChannelCapabilityKey } from '@workspace/contracts';
import type { socialAccounts, publishingPosts } from '@workspace/database';
import type { PreparedPublishingAsset } from '../publishing-media-preparation.service';
import type { ProviderResult } from './publishing-provider';

export type PublishContext = {
  post: typeof publishingPosts.$inferSelect;
  account: typeof socialAccounts.$inferSelect;
  assets: PreparedPublishingAsset[];
};

export interface ChannelPublisher {
  readonly capabilityKey: PortalChannelCapabilityKey;
  publish(context: PublishContext): Promise<ProviderResult>;
}

export const CHANNEL_PUBLISHERS = Symbol('CHANNEL_PUBLISHERS');
