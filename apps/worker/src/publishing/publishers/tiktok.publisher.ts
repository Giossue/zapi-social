import { Injectable } from '@nestjs/common';
import type { PortalChannelCapabilityKey } from '@workspace/contracts';
import { socialAccountCredentials } from '@workspace/database';
import { eq } from '@workspace/database/query';
import { DatabaseService } from '../../database/database.service';
import { Aes256GcmService } from '../../platform/crypto/aes-256-gcm.service';
import type { PreparedPublishingAsset } from '../publishing-media-preparation.service';
import type { ChannelPublisher, PublishContext } from './channel-publisher';
import { PublishingAssetReader } from './publishing-asset-reader.service';
import {
  PublishingDeliveryError,
  firstString,
  isRecord,
  providerHttpError,
  providerPost,
  responseJson,
  type ProviderResult,
} from './publishing-provider';

const apiBase = 'https://open.tiktokapis.com/v2';

@Injectable()
export class TikTokPublisher implements ChannelPublisher {
  readonly capabilityKey: PortalChannelCapabilityKey = 'tiktok_profile';

  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
    private readonly assets: PublishingAssetReader,
  ) {}

  async publish({
    post,
    account,
    assets,
  }: PublishContext): Promise<ProviderResult> {
    if (assets.length !== 1) {
      throw new PublishingDeliveryError(
        'PUBLISHING_TIKTOK_MEDIA_REQUIRED',
        true,
      );
    }
    const token = await this.token(account.id);
    const asset = assets[0];
    const publishId = asset.mimeType.startsWith('video/')
      ? await this.publishVideo(token, post.content, asset)
      : this.publishPhoto();

    await this.waitForPublish(token, publishId);
    return {
      providerRequestId: publishId,
      response: { providerRequestId: publishId },
    };
  }

  private async publishVideo(
    token: string,
    caption: string,
    asset: PreparedPublishingAsset,
  ): Promise<string> {
    const init = await providerPost(`${apiBase}/post/publish/video/init/`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({
        post_info: { title: caption, privacy_level: 'SELF_ONLY' },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: asset.sizeBytes,
          chunk_size: asset.sizeBytes,
          total_chunk_count: 1,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await responseJson(init);
    this.assertOk(init, payload);
    const data = isRecord(payload.data) ? payload.data : {};
    const publishId = firstString(data, ['publish_id']);
    const uploadUrl = firstString(data, ['upload_url']);
    if (!publishId || !uploadUrl) {
      throw new PublishingDeliveryError('PUBLISHING_PROVIDER_RESPONSE_INVALID');
    }

    const blob = await this.assets.blob(asset);
    const upload = await providerPost(uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': asset.mimeType,
        'content-range': `bytes 0-${asset.sizeBytes - 1}/${asset.sizeBytes}`,
      },
      body: blob,
      signal: AbortSignal.timeout(180_000),
    });
    if (!upload.ok) {
      throw providerHttpError(upload.status, 'PUBLISHING_TIKTOK_REJECTED');
    }
    return publishId;
  }

  private publishPhoto(): never {
    throw new PublishingDeliveryError(
      'PUBLISHING_TIKTOK_PHOTO_UNSUPPORTED',
      true,
    );
  }

  private async waitForPublish(
    token: string,
    publishId: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await providerPost(
        `${apiBase}/post/publish/status/fetch/`,
        {
          method: 'POST',
          headers: this.headers(token),
          body: JSON.stringify({ publish_id: publishId }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const payload = await responseJson(response);
      this.assertOk(response, payload);
      const data = isRecord(payload.data) ? payload.data : {};
      const status = firstString(data, ['status']);
      if (status === 'PUBLISH_COMPLETE') return;
      if (status === 'FAILED') {
        throw new PublishingDeliveryError('PUBLISHING_TIKTOK_FAILED', true);
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    throw new PublishingDeliveryError('PUBLISHING_TIKTOK_TIMEOUT');
  }

  private headers(token: string) {
    return {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
    };
  }

  private assertOk(response: Response, payload: Record<string, unknown>) {
    const error = isRecord(payload.error) ? payload.error : {};
    const code = firstString(error, ['code']);
    if (!response.ok || (code && code !== 'ok')) {
      throw providerHttpError(response.status, 'PUBLISHING_TIKTOK_REJECTED');
    }
  }

  private async token(accountId: string): Promise<string> {
    const [credential] = await this.database.db
      .select()
      .from(socialAccountCredentials)
      .where(eq(socialAccountCredentials.socialAccountId, accountId))
      .limit(1);
    if (!credential?.accessTokenCiphertext) {
      throw new PublishingDeliveryError('PUBLISHING_CREDENTIAL_MISSING', true);
    }
    try {
      return this.encryption.decrypt(
        credential.accessTokenCiphertext,
        `tiktok:account:${accountId}`,
      );
    } catch {
      throw new PublishingDeliveryError('PUBLISHING_CREDENTIAL_INVALID', true);
    }
  }
}
