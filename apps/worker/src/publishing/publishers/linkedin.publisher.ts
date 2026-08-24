import { Injectable } from '@nestjs/common';
import type { PortalChannelCapabilityKey } from '@workspace/contracts';
import {
  providerIntegrations,
  socialAccountCredentials,
} from '@workspace/database';
import { eq } from '@workspace/database/query';
import { DatabaseService } from '../../database/database.service';
import { Aes256GcmService } from '../../platform/crypto/aes-256-gcm.service';
import type { PreparedPublishingAsset } from '../publishing-media-preparation.service';
import type { ChannelPublisher, PublishContext } from './channel-publisher';
import { PublishingAssetReader } from './publishing-asset-reader.service';
import {
  PublishingDeliveryError,
  firstString,
  providerHttpError,
  providerOutcomeUnknownCode,
  providerPost,
  responseJson,
  sanitizeProviderResponse,
  type ProviderResult,
} from './publishing-provider';

const restBase = 'https://api.linkedin.com/rest';

abstract class LinkedInPublisher implements ChannelPublisher {
  abstract readonly capabilityKey: PortalChannelCapabilityKey;

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
    const apiVersion = await this.apiVersion();
    const token = await this.token(account.id);
    const author = this.author(account.externalId);

    const media = assets.length
      ? await this.uploadImage(assets[0], author, token, apiVersion)
      : null;

    const body: Record<string, unknown> = {
      author,
      commentary: post.content,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };
    if (media) body.content = { media: { id: media } };

    const response = await providerPost(`${restBase}/posts`, {
      method: 'POST',
      headers: this.headers(token, apiVersion),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw providerHttpError(response.status, 'PUBLISHING_LINKEDIN_REJECTED');
    }

    const providerRequestId = response.headers.get('x-restli-id');
    if (!providerRequestId) {
      throw new PublishingDeliveryError(providerOutcomeUnknownCode, true);
    }

    return {
      providerRequestId,
      response: sanitizeProviderResponse(
        await responseJson(response),
        providerRequestId,
      ),
    };
  }

  private async uploadImage(
    asset: PreparedPublishingAsset,
    author: string,
    token: string,
    apiVersion: string,
  ): Promise<string> {
    if (asset.mimeType.startsWith('video/')) {
      throw new PublishingDeliveryError(
        'PUBLISHING_LINKEDIN_VIDEO_UNSUPPORTED',
        true,
      );
    }

    const initialize = await providerPost(
      `${restBase}/images?action=initializeUpload`,
      {
        method: 'POST',
        headers: this.headers(token, apiVersion),
        body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!initialize.ok) {
      throw providerHttpError(
        initialize.status,
        'PUBLISHING_LINKEDIN_REJECTED',
      );
    }

    const payload = await responseJson(initialize);
    const value =
      typeof payload.value === 'object' && payload.value !== null
        ? (payload.value as Record<string, unknown>)
        : {};
    const uploadUrl = firstString(value, ['uploadUrl']);
    const imageUrn = firstString(value, ['image']);
    if (!uploadUrl || !imageUrn) {
      throw new PublishingDeliveryError('PUBLISHING_PROVIDER_RESPONSE_INVALID');
    }

    const upload = await providerPost(uploadUrl, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
      body: await this.assets.blob(asset),
      signal: AbortSignal.timeout(180_000),
    });
    if (!upload.ok) {
      throw providerHttpError(upload.status, 'PUBLISHING_LINKEDIN_REJECTED');
    }

    return imageUrn;
  }

  private headers(token: string, apiVersion: string) {
    return {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-restli-protocol-version': '2.0.0',
      'linkedin-version': apiVersion,
    };
  }

  protected abstract authorPrefix(): string;

  private author(externalId: string | null) {
    if (!externalId) {
      throw new PublishingDeliveryError('PUBLISHING_EXTERNAL_ID_MISSING', true);
    }
    return `${this.authorPrefix()}${externalId}`;
  }

  private async token(accountId: string) {
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
        `linkedin:account:${accountId}`,
      );
    } catch {
      throw new PublishingDeliveryError('PUBLISHING_CREDENTIAL_INVALID', true);
    }
  }

  private async apiVersion() {
    const [integration] = await this.database.db
      .select()
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, 'linkedin'))
      .limit(1);
    if (!integration?.enabled || !integration.configurationCiphertext) {
      throw new PublishingDeliveryError(
        'PUBLISHING_LINKEDIN_NOT_CONFIGURED',
        true,
      );
    }
    try {
      const parsed: unknown = JSON.parse(
        this.encryption.decrypt(
          integration.configurationCiphertext,
          'linkedin',
        ),
      );
      const apiVersion =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as Record<string, unknown>).apiVersion
          : null;
      if (typeof apiVersion !== 'string' || !/^\d{6}$/.test(apiVersion)) {
        throw new Error('missing');
      }
      return apiVersion;
    } catch {
      throw new PublishingDeliveryError(
        'PUBLISHING_LINKEDIN_NOT_CONFIGURED',
        true,
      );
    }
  }
}

@Injectable()
export class LinkedInProfilePublisher extends LinkedInPublisher {
  readonly capabilityKey: PortalChannelCapabilityKey = 'linkedin_profile';

  protected authorPrefix() {
    return 'urn:li:person:';
  }
}

@Injectable()
export class LinkedInPagePublisher extends LinkedInPublisher {
  readonly capabilityKey: PortalChannelCapabilityKey = 'linkedin_page';

  protected authorPrefix() {
    return 'urn:li:organization:';
  }
}
