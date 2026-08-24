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
  providerOutcomeUnknownCode,
  providerPost,
  responseJson,
  sanitizeProviderResponse,
  type ProviderResult,
} from './publishing-provider';

const apiBase = 'https://api.x.com/2';

/**
 * Publica en X con la API v2.
 *
 * La media se sube en tres pasos —INIT, APPEND en segmentos de menos de 5 MB,
 * FINALIZE— por `api.x.com/2/media/upload`, y luego se adjunta el `media_id` al
 * tweet en `POST /2/tweets`. Es la API vigente desde enero de 2025; la de
 * `upload.twitter.com/1.1` está retirada.
 */
@Injectable()
export class XPublisher implements ChannelPublisher {
  readonly capabilityKey: PortalChannelCapabilityKey = 'x_profile';

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
    const token = await this.token(account.id);

    const mediaIds: string[] = [];
    for (const asset of assets) {
      mediaIds.push(await this.uploadMedia(asset, token));
    }

    const body: Record<string, unknown> = { text: post.content };
    if (mediaIds.length) body.media = { media_ids: mediaIds };

    const response = await providerPost(`${apiBase}/tweets`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const payload = await responseJson(response);
    if (!response.ok) {
      throw providerHttpError(response.status, 'PUBLISHING_X_REJECTED');
    }
    const data = isRecord(payload.data) ? payload.data : {};
    const providerRequestId = firstString(data, ['id']);
    if (!providerRequestId) {
      throw new PublishingDeliveryError(providerOutcomeUnknownCode, true);
    }
    return {
      providerRequestId,
      response: sanitizeProviderResponse(data, providerRequestId),
    };
  }

  private async uploadMedia(
    asset: PreparedPublishingAsset,
    token: string,
  ): Promise<string> {
    const isVideo = asset.mimeType.startsWith('video/');
    const mediaId = await this.initUpload(asset, token, isVideo);
    await this.appendChunks(asset, token, mediaId);
    await this.finalizeUpload(token, mediaId);
    return mediaId;
  }

  private async initUpload(
    asset: PreparedPublishingAsset,
    token: string,
    isVideo: boolean,
  ): Promise<string> {
    const response = await providerPost(`${apiBase}/media/upload/initialize`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        media_category: isVideo ? 'tweet_video' : 'tweet_image',
        media_type: asset.mimeType,
        total_bytes: asset.sizeBytes,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await responseJson(response);
    if (!response.ok) {
      throw providerHttpError(response.status, 'PUBLISHING_X_REJECTED');
    }
    const data = isRecord(payload.data) ? payload.data : payload;
    const mediaId = firstString(data, ['id', 'media_id_string', 'media_id']);
    if (!mediaId) {
      throw new PublishingDeliveryError('PUBLISHING_PROVIDER_RESPONSE_INVALID');
    }
    return mediaId;
  }

  private async appendChunks(
    asset: PreparedPublishingAsset,
    token: string,
    mediaId: string,
  ): Promise<void> {
    const blob = await this.assets.blob(asset);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Menos de 5 MB por segmento es el límite de X.
    const chunkSize = 4 * 1024 * 1024;
    let segment = 0;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const form = new FormData();
      form.set('segment_index', String(segment));
      form.set(
        'media',
        new Blob([bytes.slice(offset, offset + chunkSize)], {
          type: asset.mimeType,
        }),
      );
      const response = await providerPost(
        `${apiBase}/media/upload/${encodeURIComponent(mediaId)}/append`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: form,
          signal: AbortSignal.timeout(120_000),
        },
      );
      if (!response.ok) {
        throw providerHttpError(response.status, 'PUBLISHING_X_REJECTED');
      }
      segment += 1;
    }
  }

  private async finalizeUpload(token: string, mediaId: string): Promise<void> {
    const response = await providerPost(
      `${apiBase}/media/upload/${encodeURIComponent(mediaId)}/finalize`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) {
      throw providerHttpError(response.status, 'PUBLISHING_X_REJECTED');
    }
    // Un vídeo puede seguir procesándose; se sondea hasta que esté listo.
    const payload = await responseJson(response);
    const data = isRecord(payload.data) ? payload.data : payload;
    const info = isRecord(data.processing_info) ? data.processing_info : null;
    if (info) await this.waitForProcessing(token, mediaId);
  }

  private async waitForProcessing(
    token: string,
    mediaId: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const url = new URL(`${apiBase}/media/upload`);
      url.search = new URLSearchParams({
        command: 'STATUS',
        media_id: mediaId,
      }).toString();
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await responseJson(response);
      if (!response.ok) {
        throw providerHttpError(response.status, 'PUBLISHING_X_REJECTED');
      }
      const data = isRecord(payload.data) ? payload.data : payload;
      const info = isRecord(data.processing_info) ? data.processing_info : {};
      const state = firstString(info, ['state']);
      if (state === 'succeeded') return;
      if (state === 'failed') {
        throw new PublishingDeliveryError('PUBLISHING_X_MEDIA_FAILED', true);
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    throw new PublishingDeliveryError('PUBLISHING_X_MEDIA_TIMEOUT');
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
        `x:account:${accountId}`,
      );
    } catch {
      throw new PublishingDeliveryError('PUBLISHING_CREDENTIAL_INVALID', true);
    }
  }
}
