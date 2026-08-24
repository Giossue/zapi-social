import { Injectable } from '@nestjs/common';
import type { PortalChannelCapabilityKey } from '@workspace/contracts';
import type { ChannelPublisher, PublishContext } from './channel-publisher';
import { MetaGraphService } from './meta-graph.service';
import { PublishingDeliveryError } from './publishing-provider';

@Injectable()
export class FacebookPagePublisher implements ChannelPublisher {
  readonly capabilityKey: PortalChannelCapabilityKey = 'facebook_page';

  constructor(private readonly meta: MetaGraphService) {}

  async publish({ post, account, assets }: PublishContext) {
    const token = await this.meta.token(account);
    const externalId = this.meta.requireExternalId(account);

    if (!assets.length) {
      return this.meta.request(`${externalId}/feed`, {
        access_token: token,
        message: post.content,
      });
    }

    if (assets.length === 1) {
      const asset = assets[0];
      const isVideo = asset.mimeType.startsWith('video/');
      const form = await this.meta.assetForm(asset, token);
      form.set(isVideo ? 'description' : 'message', post.content);
      return this.meta.multipart(
        `${externalId}/${isVideo ? 'videos' : 'photos'}`,
        form,
      );
    }

    if (assets.some((asset) => !asset.mimeType.startsWith('image/'))) {
      throw new PublishingDeliveryError(
        'PUBLISHING_MEDIA_COMBINATION_UNSUPPORTED',
        true,
      );
    }

    const uploaded: string[] = [];
    for (const asset of assets) {
      const form = await this.meta.assetForm(asset, token);
      form.set('published', 'false');
      const result = await this.meta.multipart(`${externalId}/photos`, form);
      if (!result.providerRequestId) {
        throw new PublishingDeliveryError(
          'PUBLISHING_PROVIDER_RESPONSE_INVALID',
        );
      }
      uploaded.push(result.providerRequestId);
    }

    const fields: Record<string, string> = {
      access_token: token,
      message: post.content,
    };
    uploaded.forEach((id, index) => {
      fields[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
    });
    return this.meta.request(`${externalId}/feed`, fields);
  }
}
