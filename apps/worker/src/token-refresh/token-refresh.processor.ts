import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  providerIntegrations,
  socialAccountCredentials,
  socialAccounts,
} from '@workspace/database';
import { and, eq, isNull, lt, not } from '@workspace/database/query';
import { type Job } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import {
  TOKEN_REFRESH_JOB,
  TOKEN_REFRESH_QUEUE,
  TOKEN_REFRESH_THRESHOLD_MS,
} from './token-refresh.constants';

const refreshable = new Set(['x', 'tiktok']);

type RefreshedToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
};

@Injectable()
@Processor(TOKEN_REFRESH_QUEUE)
export class TokenRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(TokenRefreshProcessor.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== TOKEN_REFRESH_JOB) return;

    const threshold = new Date(Date.now() + TOKEN_REFRESH_THRESHOLD_MS);
    const rows = await this.database.db
      .select({
        accountId: socialAccounts.id,
        providerKey: socialAccounts.providerKey,
        refreshTokenCiphertext: socialAccountCredentials.refreshTokenCiphertext,
      })
      .from(socialAccountCredentials)
      .innerJoin(
        socialAccounts,
        eq(socialAccountCredentials.socialAccountId, socialAccounts.id),
      )
      .where(
        and(
          not(isNull(socialAccountCredentials.refreshTokenCiphertext)),
          lt(socialAccountCredentials.expiresAt, threshold),
          eq(socialAccounts.status, 'active'),
        ),
      )
      .limit(100);

    let refreshed = 0;
    for (const row of rows) {
      if (!refreshable.has(row.providerKey) || !row.refreshTokenCiphertext) {
        continue;
      }
      try {
        const refreshToken = this.encryption.decrypt(
          row.refreshTokenCiphertext,
          `${row.providerKey}:account:${row.accountId}:refresh`,
        );
        const token = await this.refresh(row.providerKey, refreshToken);
        if (token) {
          await this.store(row.providerKey, row.accountId, token);
          refreshed += 1;
        }
      } catch (error) {
        this.logger.warn(
          `Token refresh failed: provider=${row.providerKey} account=${row.accountId} ${String(error)}`,
        );
      }
    }

    if (refreshed) this.logger.log(`Refreshed ${refreshed} channel tokens`);
  }

  private async refresh(
    providerKey: string,
    refreshToken: string,
  ): Promise<RefreshedToken | null> {
    const configuration = await this.providerConfiguration(providerKey);
    if (!configuration) return null;

    if (providerKey === 'x') {
      const response = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: `Basic ${Buffer.from(`${configuration.clientId}:${configuration.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      return this.parse(response);
    }

    const response = await fetch(
      'https://open.tiktokapis.com/v2/oauth/token/',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: configuration.clientId,
          client_secret: configuration.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    return this.parse(response);
  }

  private async parse(response: Response): Promise<RefreshedToken | null> {
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || typeof body !== 'object' || body === null) return null;
    const record = body as Record<string, unknown>;
    const accessToken = record.access_token;
    if (typeof accessToken !== 'string' || !accessToken) return null;
    return {
      accessToken,
      refreshToken:
        typeof record.refresh_token === 'string'
          ? record.refresh_token
          : undefined,
      expiresAt:
        typeof record.expires_in === 'number'
          ? new Date(Date.now() + record.expires_in * 1000)
          : undefined,
    };
  }

  private async store(
    providerKey: string,
    accountId: string,
    token: RefreshedToken,
  ): Promise<void> {
    const aad = `${providerKey}:account:${accountId}`;
    await this.database.db
      .update(socialAccountCredentials)
      .set({
        accessTokenCiphertext: this.encryption.encrypt(token.accessToken, aad),
        ...(token.refreshToken
          ? {
              refreshTokenCiphertext: this.encryption.encrypt(
                token.refreshToken,
                `${aad}:refresh`,
              ),
            }
          : {}),
        expiresAt: token.expiresAt ?? null,
        encryptionKeyVersion: this.encryption.keyVersion,
        rotatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(socialAccountCredentials.socialAccountId, accountId));
  }

  private async providerConfiguration(
    providerKey: string,
  ): Promise<{ clientId: string; clientSecret: string } | null> {
    const [row] = await this.database.db
      .select({
        enabled: providerIntegrations.enabled,
        configurationCiphertext: providerIntegrations.configurationCiphertext,
      })
      .from(providerIntegrations)
      .where(eq(providerIntegrations.providerKey, providerKey))
      .limit(1);
    if (!row?.enabled || !row.configurationCiphertext) return null;
    try {
      const parsed: unknown = JSON.parse(
        this.encryption.decrypt(row.configurationCiphertext, providerKey),
      );
      if (typeof parsed !== 'object' || parsed === null) return null;
      const record = parsed as Record<string, unknown>;
      const clientId = record.clientId ?? record.clientKey;
      const clientSecret = record.clientSecret;
      if (typeof clientId !== 'string' || typeof clientSecret !== 'string') {
        return null;
      }
      return { clientId, clientSecret };
    } catch {
      return null;
    }
  }
}
