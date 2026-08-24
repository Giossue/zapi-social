import { Inject, Injectable } from '@nestjs/common';
import type { PortalChannelCapabilityKey } from '@workspace/contracts';
import { CHANNEL_PUBLISHERS, type ChannelPublisher } from './channel-publisher';

@Injectable()
export class ChannelPublisherRegistry {
  private readonly byCapability: Map<
    PortalChannelCapabilityKey,
    ChannelPublisher
  >;

  constructor(
    @Inject(CHANNEL_PUBLISHERS) publishers: readonly ChannelPublisher[],
  ) {
    this.byCapability = new Map(
      publishers.map((publisher) => [publisher.capabilityKey, publisher]),
    );
  }

  find(capabilityKey: string): ChannelPublisher | undefined {
    return this.byCapability.get(capabilityKey as PortalChannelCapabilityKey);
  }

  capabilities(): PortalChannelCapabilityKey[] {
    return [...this.byCapability.keys()];
  }
}
