import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import { type PortalAuthSession } from '@workspace/contracts';
import { socialAccounts } from '@workspace/database';
import { and, eq, sql } from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const META_PROFILE_SYNC_QUEUE = 'meta-profile-sync';
const WHATSAPP_PROFILE_SYNC_QUEUE = 'whatsapp-profile-sync';
const PROFILE_SYNC_JOB = 'sync-profile';
const MANUAL_REFRESH_COOLDOWN_MS = 15 * 60 * 1_000;
const managerRoles = new Set(['owner', 'admin']);

type SupportedProviderKey = 'meta' | 'whatsapp-status';
type SocialAccount = typeof socialAccounts.$inferSelect;

@Injectable()
export class ProfileSyncService {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue(META_PROFILE_SYNC_QUEUE)
    private readonly metaProfileSyncQueue: Queue<{ accountId: string }>,
    @InjectQueue(WHATSAPP_PROFILE_SYNC_QUEUE)
    private readonly whatsappProfileSyncQueue: Queue<{ accountId: string }>,
  ) {}

  async requestManualSync(session: PortalAuthSession, id: string) {
    this.requireManager(session);
    const accountId = this.parseId(id);
    const account = await this.accountForWorkspace(
      session.workspace.id,
      accountId,
    );
    const providerKey = this.supportedProvider(account);
    const acceptedAt = new Date();
    const nextAllowedAt = new Date(
      acceptedAt.getTime() + MANUAL_REFRESH_COOLDOWN_MS,
    );
    const previousRequestedAt = this.requestedAt(account.metadata);

    if (
      previousRequestedAt &&
      previousRequestedAt.getTime() >
        acceptedAt.getTime() - MANUAL_REFRESH_COOLDOWN_MS
    ) {
      throw new AppException(
        'CHANNEL_PROFILE_SYNC_COOLDOWN',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [reserved] = await this.database.db
      .update(socialAccounts)
      .set({
        metadata: sql`jsonb_set(${socialAccounts.metadata}, '{profileManualRefreshRequestedAt}', to_jsonb(${acceptedAt.toISOString()}::text), true)`,
        updatedAt: acceptedAt,
      })
      .where(
        and(
          eq(socialAccounts.id, account.id),
          eq(socialAccounts.workspaceId, session.workspace.id),
          eq(socialAccounts.status, 'active'),
          this.cooldownAvailable(acceptedAt),
        ),
      )
      .returning({ id: socialAccounts.id });

    if (!reserved) {
      await this.throwReservationFailure(
        session.workspace.id,
        accountId,
        acceptedAt,
      );
    }

    try {
      await this.queueFor(providerKey).add(
        PROFILE_SYNC_JOB,
        { accountId: account.id },
        {
          jobId: `manual-profile-sync-${account.id}-${randomUUID()}`,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch {
      await this.revertReservation(account.id, acceptedAt, previousRequestedAt);
      throw new AppException(
        'INFRASTRUCTURE_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      acceptedAt: acceptedAt.toISOString(),
      nextAllowedAt: nextAllowedAt.toISOString(),
    };
  }

  private async accountForWorkspace(
    workspaceId: string,
    accountId: string,
  ): Promise<SocialAccount> {
    const [account] = await this.database.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.id, accountId),
          eq(socialAccounts.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!account) throw new NotFoundException();
    return account;
  }

  private supportedProvider(account: SocialAccount): SupportedProviderKey {
    if (account.status !== 'active') {
      throw new AppException(
        'CHANNEL_PROFILE_SYNC_UNAVAILABLE',
        HttpStatus.CONFLICT,
      );
    }
    if (account.providerKey === 'meta') return 'meta';
    if (account.providerKey === 'whatsapp-status') return 'whatsapp-status';
    throw new AppException(
      'CHANNEL_PROFILE_SYNC_UNSUPPORTED',
      HttpStatus.CONFLICT,
    );
  }

  private queueFor(providerKey: SupportedProviderKey) {
    return providerKey === 'meta'
      ? this.metaProfileSyncQueue
      : this.whatsappProfileSyncQueue;
  }

  private cooldownAvailable(now: Date) {
    const threshold = new Date(
      now.getTime() - MANUAL_REFRESH_COOLDOWN_MS,
    ).toISOString();
    return sql`(
      ${socialAccounts.metadata} ->> 'profileManualRefreshRequestedAt' is null
      or ${socialAccounts.metadata} ->> 'profileManualRefreshRequestedAt' <= ${threshold}
    )`;
  }

  private async throwReservationFailure(
    workspaceId: string,
    accountId: string,
    now: Date,
  ): Promise<never> {
    const account = await this.accountForWorkspace(workspaceId, accountId);
    this.supportedProvider(account);
    const requestedAt = this.requestedAt(account.metadata);
    if (
      requestedAt &&
      requestedAt.getTime() > now.getTime() - MANUAL_REFRESH_COOLDOWN_MS
    ) {
      throw new AppException(
        'CHANNEL_PROFILE_SYNC_COOLDOWN',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    throw new AppException(
      'CHANNEL_PROFILE_SYNC_UNAVAILABLE',
      HttpStatus.CONFLICT,
    );
  }

  private async revertReservation(
    accountId: string,
    acceptedAt: Date,
    previousRequestedAt: Date | null,
  ) {
    const reservation = acceptedAt.toISOString();
    const metadata = previousRequestedAt
      ? sql`jsonb_set(${socialAccounts.metadata}, '{profileManualRefreshRequestedAt}', to_jsonb(${previousRequestedAt.toISOString()}::text), true)`
      : sql`${socialAccounts.metadata} - 'profileManualRefreshRequestedAt'`;

    await this.database.db
      .update(socialAccounts)
      .set({ metadata })
      .where(
        and(
          eq(socialAccounts.id, accountId),
          sql`${socialAccounts.metadata} ->> 'profileManualRefreshRequestedAt' = ${reservation}`,
        ),
      );
  }

  private requestedAt(metadata: Record<string, unknown>): Date | null {
    const value = metadata.profileManualRefreshRequestedAt;
    if (typeof value !== 'string') return null;
    const requestedAt = new Date(value);
    return Number.isNaN(requestedAt.getTime()) ? null : requestedAt;
  }

  private requireManager(session: PortalAuthSession) {
    if (!managerRoles.has(session.workspace.role)) {
      throw new AppException(
        'AUTH_WORKSPACE_UNAVAILABLE',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private parseId(id: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    return id;
  }
}
