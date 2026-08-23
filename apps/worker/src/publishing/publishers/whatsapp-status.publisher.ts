import { Injectable } from '@nestjs/common';
import type { PortalChannelCapabilityKey } from '@workspace/contracts';
import { providerIntegrations } from '@workspace/database';
import { eq } from '@workspace/database/query';
import { DatabaseService } from '../../database/database.service';
import { PublishingAssetReader } from './publishing-asset-reader.service';
import { Aes256GcmService } from '../../platform/crypto/aes-256-gcm.service';
import type { ChannelPublisher, PublishContext } from './channel-publisher';
import {
  PublishingDeliveryError,
  firstString,
  isProviderSuccess,
  isRecord,
  providerHttpError,
  providerOutcomeUnknownCode,
  providerPost,
  responseJson,
  sanitizeProviderResponse,
} from './publishing-provider';

type WhatsAppConfiguration = {
  baseUrl: string;
  basicAuthUsername: string;
  basicAuthPassword: string;
};

@Injectable()
export class WhatsAppStatusPublisher implements ChannelPublisher {
  readonly capabilityKey: PortalChannelCapabilityKey = 'whatsapp_status';

  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
    private readonly assets: PublishingAssetReader,
  ) {}

  async publish({ post, account, assets }: PublishContext) {
    if (assets.length !== 1) {
      throw new PublishingDeliveryError(
        'PUBLISHING_WHATSAPP_MEDIA_REQUIRED',
        true,
      );
    }

    const configuration = await this.configuration();
    const deviceId = stringMetadata(account.metadata, 'deviceId');
    if (!deviceId) {
      throw new PublishingDeliveryError(
        'PUBLISHING_WHATSAPP_NOT_CONFIGURED',
        true,
      );
    }

    const asset = assets[0];
    const isVideo = asset.mimeType.startsWith('video/');
    const form = new FormData();
    form.set('phone', 'status@broadcast');
    form.set('caption', post.content);
    form.set('compress', 'false');
    form.set(
      isVideo ? 'video' : 'image',
      await this.assets.blob(asset),
      asset.name,
    );

    const response = await providerPost(
      `${configuration.baseUrl}${isVideo ? '/send/video' : '/send/image'}`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(
            `${configuration.basicAuthUsername}:${configuration.basicAuthPassword}`,
          ).toString('base64')}`,
          'x-device-id': deviceId,
        },
        body: form,
        signal: AbortSignal.timeout(180_000),
      },
    );

    const payload = await responseJson(response);
    if (!response.ok || !isProviderSuccess(payload)) {
      throw providerHttpError(response.status, 'PUBLISHING_WHATSAPP_REJECTED');
    }

    const providerRequestId = firstString(payload, [
      'id',
      'message_id',
      'messageId',
    ]);
    if (!providerRequestId) {
      throw new PublishingDeliveryError(providerOutcomeUnknownCode, true);
    }

    return {
      providerRequestId,
      response: sanitizeProviderResponse(payload, providerRequestId),
    };
  }

  private async configuration(): Promise<WhatsAppConfiguration> {
    const [integration] = await this.database.db
      .select()
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, 'whatsapp-status'))
      .limit(1);
    if (
      !integration?.enabled ||
      integration.readiness !== 'ready' ||
      !integration.configurationCiphertext
    ) {
      throw new PublishingDeliveryError(
        'PUBLISHING_WHATSAPP_NOT_CONFIGURED',
        true,
      );
    }
    const parsed = parseConfiguration(
      this.encryption.decrypt(
        integration.configurationCiphertext,
        'whatsapp-status',
      ),
    );
    if (!parsed) {
      throw new PublishingDeliveryError(
        'PUBLISHING_WHATSAPP_NOT_CONFIGURED',
        true,
      );
    }
    return parsed;
  }
}

function stringMetadata(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  return typeof candidate === 'string' && candidate ? candidate : null;
}

function parseConfiguration(value: string): WhatsAppConfiguration | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      typeof parsed.baseUrl !== 'string' ||
      typeof parsed.basicAuthUsername !== 'string' ||
      typeof parsed.basicAuthPassword !== 'string'
    ) {
      return null;
    }
    return {
      baseUrl: parsed.baseUrl.replace(/\/+$/, ''),
      basicAuthUsername: parsed.basicAuthUsername,
      basicAuthPassword: parsed.basicAuthPassword,
    };
  } catch {
    return null;
  }
}
