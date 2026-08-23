import type { PortalChannelCapabilityKey } from '@workspace/contracts';
import type { socialAccounts, publishingPosts } from '@workspace/database';
import type { PreparedPublishingAsset } from '../publishing-media-preparation.service';
import type { ProviderResult } from './publishing-provider';

export type PublishContext = {
  post: typeof publishingPosts.$inferSelect;
  account: typeof socialAccounts.$inferSelect;
  assets: PreparedPublishingAsset[];
};

/**
 * Lo que tiene que aportar una red para poder publicar. Todo lo demás —reclamar
 * el intento, la prórroga, el reintento, el cierre— es del procesador y no se
 * repite por red.
 */
export interface ChannelPublisher {
  readonly capabilityKey: PortalChannelCapabilityKey;
  publish(context: PublishContext): Promise<ProviderResult>;
}

export const CHANNEL_PUBLISHERS = Symbol('CHANNEL_PUBLISHERS');
