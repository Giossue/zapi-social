import { Injectable } from '@nestjs/common';
import type { PortalChannelCapabilityKey } from '@workspace/contracts';
import type { ChannelPublisher, PublishContext } from './channel-publisher';
import { MetaGraphService } from './meta-graph.service';
import { PublishingDeliveryError } from './publishing-provider';

@Injectable()
export class InstagramProfilePublisher implements ChannelPublisher {
  readonly capabilityKey: PortalChannelCapabilityKey = 'instagram_profile';

  constructor(private readonly meta: MetaGraphService) {}

  async publish({ post, account, assets }: PublishContext) {
    if (assets.length !== 1) {
      throw new PublishingDeliveryError(
        'PUBLISHING_INSTAGRAM_MEDIA_REQUIRED',
        true,
      );
    }

    const token = await this.meta.token(account);
    const externalId = this.meta.requireExternalId(account);
    const asset = assets[0];
    const isVideo = asset.mimeType.startsWith('video/');

    // Instagram descarga la media por URL en vez de recibirla subida.
    const createFields: Record<string, string> = {
      access_token: token,
      caption: post.content,
      [isVideo ? 'video_url' : 'image_url']: this.meta.publicMediaUrl(
        asset.id,
        asset.publicVariant,
      ),
    };
    if (isVideo) createFields.media_type = 'REELS';

    const container = await this.meta.request(
      `${externalId}/media`,
      createFields,
    );
    if (!container.providerRequestId) {
      throw new PublishingDeliveryError('PUBLISHING_PROVIDER_RESPONSE_INVALID');
    }

    await this.meta.waitForContainer(container.providerRequestId, token);

    return this.meta.request(`${externalId}/media_publish`, {
      access_token: token,
      creation_id: container.providerRequestId,
    });
  }
}
