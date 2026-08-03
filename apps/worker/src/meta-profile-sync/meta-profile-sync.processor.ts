import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { type Job } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import {
  Aes256GcmService,
  DecryptionFailedError,
} from '../platform/crypto/aes-256-gcm.service';
import {
  META_PROFILE_SYNC_CONCURRENCY,
  META_PROFILE_SYNC_DUE_INTERVAL_MS,
  META_PROFILE_SYNC_JOB,
  META_PROFILE_SYNC_QUEUE,
  type MetaProfileSyncJobData,
} from './meta-profile-sync.constants';

type MetaAccount = {
  id: string;
  capabilityKey: string;
  externalId: string | null;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  metadata: Record<string, unknown>;
};

type ProfileSnapshot = {
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
};

class ProfileSyncError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

@Injectable()
@Processor(META_PROFILE_SYNC_QUEUE, {
  concurrency: META_PROFILE_SYNC_CONCURRENCY,
})
export class MetaProfileSyncProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: Aes256GcmService,
  ) {
    super();
  }

  async process(job: Job<MetaProfileSyncJobData>): Promise<void> {
    if (job.name !== META_PROFILE_SYNC_JOB) return;

    const account = await this.findActiveMetaAccount(job.data.accountId);
    if (!account) return;

    const auditId = await this.createAuditRun(account, job.id);

    try {
      const credential = await this.database.client<
        { accessTokenCiphertext: string | null }[]
      >`
        select access_token_ciphertext as "accessTokenCiphertext"
        from social_account_credentials
        where social_account_id = ${account.id}
        limit 1
      `;
      if (!credential[0]?.accessTokenCiphertext) {
        throw new ProfileSyncError('CREDENTIAL_MISSING');
      }

      let accessToken: string;
      try {
        accessToken = this.encryption.decrypt(
          credential[0].accessTokenCiphertext,
          `meta:account:${account.id}`,
        );
      } catch (error) {
        if (error instanceof DecryptionFailedError) {
          throw new ProfileSyncError('TOKEN_DECRYPTION_FAILED');
        }
        throw error;
      }

      const profile = await this.fetchProfile(account, accessToken);
      await this.persistProfile(account, profile);
      await this.finishAuditRun(auditId, 'succeeded');
    } catch (error) {
      const errorCode =
        error instanceof ProfileSyncError ? error.code : 'PROFILE_SYNC_FAILED';
      await this.finishAuditRun(auditId, 'failed', errorCode);
      throw new Error(errorCode);
    }
  }

  private async findActiveMetaAccount(
    accountId: string,
  ): Promise<MetaAccount | null> {
    const accounts = await this.database.client<MetaAccount[]>`
      select
        id,
        capability_key as "capabilityKey",
        external_id as "externalId",
        display_name as "displayName",
        handle,
        avatar_url as "avatarUrl",
        profile_url as "profileUrl",
        metadata
      from social_accounts
      where id = ${accountId}
        and provider_key = 'meta'
        and status = 'active'
        and capability_key in ('facebook_page', 'instagram_profile')
      limit 1
    `;
    return accounts[0] ?? null;
  }

  private async createAuditRun(
    account: MetaAccount,
    jobId: string | undefined,
  ): Promise<string> {
    const runs = await this.database.client<{ id: string }[]>`
      insert into channel_sync_runs (
        social_account_id,
        status,
        job_id,
        started_at,
        metadata
      )
      values (
        ${account.id},
        'running',
        ${jobId ?? null},
        now(),
        ${JSON.stringify({ operation: 'meta_profile_sync', capabilityKey: account.capabilityKey })}::jsonb
      )
      returning id
    `;
    const auditId = runs[0]?.id;
    if (!auditId) throw new ProfileSyncError('AUDIT_WRITE_FAILED');
    return auditId;
  }

  private async finishAuditRun(
    auditId: string,
    status: 'succeeded' | 'failed',
    errorCode?: string,
  ) {
    await this.database.client`
      update channel_sync_runs
      set status = ${status}, error_code = ${errorCode ?? null}, finished_at = now()
      where id = ${auditId}
    `;
  }

  private async persistProfile(account: MetaAccount, profile: ProfileSnapshot) {
    const now = new Date();
    const nextMetadata = {
      ...account.metadata,
      profileSyncDueAt: new Date(
        now.getTime() + META_PROFILE_SYNC_DUE_INTERVAL_MS,
      ).toISOString(),
    };

    await this.database.client`
      update social_accounts
      set
        display_name = case when ${account.displayName !== profile.displayName} then ${profile.displayName} else display_name end,
        handle = case when ${account.handle !== profile.handle} then ${profile.handle} else handle end,
        avatar_url = case when ${account.avatarUrl !== profile.avatarUrl} then ${profile.avatarUrl} else avatar_url end,
        profile_url = case when ${account.profileUrl !== profile.profileUrl} then ${profile.profileUrl} else profile_url end,
        metadata = ${JSON.stringify(nextMetadata)}::jsonb,
        updated_at = ${now.toISOString()}
      where id = ${account.id}
    `;
  }

  private async fetchProfile(
    account: MetaAccount,
    accessToken: string,
  ): Promise<ProfileSnapshot> {
    const fields =
      account.capabilityKey === 'facebook_page'
        ? 'id,name,picture{url}'
        : account.capabilityKey === 'instagram_profile'
          ? 'id,username,profile_picture_url'
          : null;

    if (!fields) throw new ProfileSyncError('UNSUPPORTED_CAPABILITY');
    if (!account.externalId) throw new ProfileSyncError('EXTERNAL_ID_MISSING');

    const url = new URL(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(account.externalId)}`,
    );
    url.search = new URLSearchParams({
      fields,
      access_token: accessToken,
    }).toString();

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new ProfileSyncError('GRAPH_TIMEOUT');
      }
      throw new ProfileSyncError('GRAPH_REQUEST_FAILED');
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        throw new ProfileSyncError('GRAPH_UNAUTHORIZED');
      if (response.status === 429)
        throw new ProfileSyncError('GRAPH_RATE_LIMITED');
      throw new ProfileSyncError('GRAPH_REQUEST_REJECTED');
    }

    if (account.capabilityKey === 'facebook_page') {
      const profile = parseFacebookProfile(payload);
      if (!profile) throw new ProfileSyncError('GRAPH_RESPONSE_INVALID');
      return {
        displayName: profile.name,
        handle: account.handle,
        avatarUrl: profile.pictureUrl,
        profileUrl: `https://www.facebook.com/${encodeURIComponent(profile.id)}`,
      };
    }

    const profile = parseInstagramProfile(payload);
    if (!profile) throw new ProfileSyncError('GRAPH_RESPONSE_INVALID');
    return {
      displayName: profile.username,
      handle: profile.username,
      avatarUrl: profile.profilePictureUrl,
      profileUrl: `https://www.instagram.com/${encodeURIComponent(profile.username)}/`,
    };
  }
}

function parseFacebookProfile(
  payload: unknown,
): { id: string; name: string; pictureUrl: string | null } | null {
  if (
    !isRecord(payload) ||
    typeof payload.id !== 'string' ||
    typeof payload.name !== 'string'
  )
    return null;
  const picture =
    isRecord(payload.picture) && isRecord(payload.picture.data)
      ? payload.picture.data
      : null;
  return {
    id: payload.id,
    name: payload.name,
    pictureUrl: picture && typeof picture.url === 'string' ? picture.url : null,
  };
}

function parseInstagramProfile(
  payload: unknown,
): { id: string; username: string; profilePictureUrl: string | null } | null {
  if (
    !isRecord(payload) ||
    typeof payload.id !== 'string' ||
    typeof payload.username !== 'string'
  )
    return null;
  return {
    id: payload.id,
    username: payload.username,
    profilePictureUrl:
      typeof payload.profile_picture_url === 'string'
        ? payload.profile_picture_url
        : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
