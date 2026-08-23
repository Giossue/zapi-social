import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { socialAccountCredentials, socialAccounts } from '@workspace/database';
import { eq } from '@workspace/database/query';
import { DatabaseService } from '../../database/database.service';
import { Aes256GcmService } from '../../platform/crypto/aes-256-gcm.service';
import { PublishingAssetReader } from './publishing-asset-reader.service';
import type { PreparedPublishingAsset } from '../publishing-media-preparation.service';
import {
  PublishingDeliveryError,
  firstString,
  providerHttpError,
  providerPost,
  providerOutcomeUnknownCode,
  responseJson,
  sanitizeProviderResponse,
  type ProviderResult,
} from './publishing-provider';

type Account = typeof socialAccounts.$inferSelect;

const graphVersion = 'v22.0';

/**
 * Todo lo que Facebook e Instagram comparten: el token de la cuenta, las dos
 * formas de llamar al Graph, la espera del contenedor de Instagram y la URL
 * firmada con la que Instagram descarga la media.
 */
@Injectable()
export class MetaGraphService {
  private readonly apiPublicOrigin: string;
  private readonly signingKey: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
    private readonly assets: PublishingAssetReader,
    config: ConfigService,
  ) {
    this.apiPublicOrigin = config.get<string>('API_PUBLIC_ORIGIN', '');
    this.signingKey = config.getOrThrow<string>(
      'PROVIDER_INTEGRATIONS_ENCRYPTION_KEY',
    );
  }

  async token(account: Account) {
    const [credential] = await this.database.db
      .select()
      .from(socialAccountCredentials)
      .where(eq(socialAccountCredentials.socialAccountId, account.id))
      .limit(1);
    if (!credential?.accessTokenCiphertext) {
      throw new PublishingDeliveryError('PUBLISHING_CREDENTIAL_MISSING', true);
    }
    try {
      return this.encryption.decrypt(
        credential.accessTokenCiphertext,
        `meta:account:${account.id}`,
      );
    } catch {
      throw new PublishingDeliveryError('PUBLISHING_CREDENTIAL_INVALID', true);
    }
  }

  requireExternalId(account: Account) {
    if (!account.externalId) {
      throw new PublishingDeliveryError('PUBLISHING_EXTERNAL_ID_MISSING', true);
    }
    return encodeURIComponent(account.externalId);
  }

  async request(path: string, fields: Record<string, string>) {
    const response = await providerPost(
      `https://graph.facebook.com/${graphVersion}/${path}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields),
        signal: AbortSignal.timeout(60_000),
      },
    );
    return this.parseResponse(response);
  }

  async multipart(path: string, form: FormData) {
    const response = await providerPost(
      `https://graph.facebook.com/${graphVersion}/${path}`,
      {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(180_000),
      },
    );
    return this.parseResponse(response);
  }

  /**
   * Instagram no publica el contenedor hasta que termina de procesarlo, así que
   * hay que esperarlo. Veinte intentos de dos segundos cubren un vídeo corto;
   * pasado eso se reintenta el trabajo entero.
   */
  async waitForContainer(containerId: string, token: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const url = new URL(
        `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(containerId)}`,
      );
      url.search = new URLSearchParams({
        access_token: token,
        fields: 'status_code',
      }).toString();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await responseJson(response);
      if (!response.ok) {
        throw providerHttpError(response.status, 'PUBLISHING_META_REJECTED');
      }
      const status = firstString(payload, ['status_code']);
      if (status === 'FINISHED') return;
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new PublishingDeliveryError(
          'PUBLISHING_INSTAGRAM_CONTAINER_FAILED',
          true,
        );
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
    }
    throw new PublishingDeliveryError('PUBLISHING_INSTAGRAM_CONTAINER_TIMEOUT');
  }

  /** Instagram descarga la media por URL, así que se firma y caduca en 15 min. */
  publicMediaUrl(assetId: string, variant?: string) {
    if (!this.apiPublicOrigin) {
      throw new PublishingDeliveryError(
        'PUBLISHING_PUBLIC_ORIGIN_MISSING',
        true,
      );
    }
    const expires = Math.floor(Date.now() / 1000) + 15 * 60;
    const signature = createHmac('sha256', this.signingKey)
      .update(`${assetId}.${variant ?? ''}.${expires}`)
      .digest('hex');
    const url = new URL(
      `/v1/public/publishing-media/${encodeURIComponent(assetId)}`,
      this.apiPublicOrigin,
    );
    url.search = new URLSearchParams({
      expires: String(expires),
      signature,
      ...(variant ? { variant } : {}),
    }).toString();
    return url.toString();
  }

  async assetForm(asset: PreparedPublishingAsset, token: string) {
    const form = new FormData();
    form.set('access_token', token);
    form.set('source', await this.assets.blob(asset), asset.name);
    return form;
  }

  private async parseResponse(response: Response): Promise<ProviderResult> {
    const payload = await responseJson(response);
    if (!response.ok || isErrorPayload(payload)) {
      throw providerHttpError(response.status, 'PUBLISHING_META_REJECTED');
    }
    const providerRequestId = firstString(payload, ['id', 'post_id']);
    if (!providerRequestId) {
      throw new PublishingDeliveryError(providerOutcomeUnknownCode, true);
    }
    return {
      providerRequestId,
      response: sanitizeProviderResponse(payload, providerRequestId),
    };
  }
}

function isErrorPayload(payload: Record<string, unknown>) {
  const error = payload.error;
  return typeof error === 'object' && error !== null && !Array.isArray(error);
}
