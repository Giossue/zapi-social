import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { channelOauthStates, socialAccounts } from '@workspace/database';
import {
  channelOAuthContextSchema,
  channelOAuthStartSchema,
  channelOAuthStateTokenSchema,
  type PortalAuthSession,
  type ChannelOAuthContext,
  type ChannelOAuthStart,
  type ChannelOAuthStartResponse,
  type ChannelOAuthStateResponse,
} from '@workspace/contracts';
import { and, eq, gt, isNull } from '@workspace/database/query';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../../database/database.service';
import { Aes256GcmService } from '../../platform/crypto/aes-256-gcm.service';
import { AppException } from '../../platform/errors/app-exception';

const stateLifetimeMilliseconds = 10 * 60 * 1000;
const managerRoles = new Set(['owner', 'admin']);

type OAuthStateRow = typeof channelOauthStates.$inferSelect;

export type ValidatedChannelOAuthState = {
  id: string;
  providerKey: string;
  capabilityKey: string;
  userId: string;
  workspaceId: string;
  reconnectAccountId: string | null;
  context: ChannelOAuthContext;
  pkceVerifier: string;
};

@Injectable()
export class ChannelOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  async start(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<ChannelOAuthStartResponse> {
    this.requireManager(session);
    const parsed = channelOAuthStartSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const values = parsed.data;
    await this.assertReconnectAccount(session, values);

    const id = randomUUID();
    const state = randomBytes(48).toString('base64url');
    const stateHash = this.hashState(state);
    const expiresAt = new Date(Date.now() + stateLifetimeMilliseconds);
    const aad = this.aad({
      id,
      stateHash,
      providerKey: values.providerKey,
      capabilityKey: values.capabilityKey,
      userId: session.user.id,
      workspaceId: session.workspace.id,
    });
    const encryption = this.encryption();

    await this.database.db.insert(channelOauthStates).values({
      id,
      stateHash,
      providerKey: values.providerKey,
      capabilityKey: values.capabilityKey,
      userId: session.user.id,
      workspaceId: session.workspace.id,
      pkceVerifierCiphertext: encryption.encrypt(
        randomBytes(48).toString('base64url'),
        `${aad}:pkce`,
      ),
      contextCiphertext: encryption.encrypt(
        JSON.stringify(values.context ?? {}),
        `${aad}:context`,
      ),
      reconnectAccountId: values.reconnectAccountId ?? null,
      expiresAt,
    });

    return {
      state,
      providerKey: values.providerKey,
      capabilityKey: values.capabilityKey,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async status(
    session: PortalAuthSession,
    state: unknown,
  ): Promise<ChannelOAuthStateResponse> {
    const token = this.parseState(state);
    const [record] = await this.database.db
      .select()
      .from(channelOauthStates)
      .where(
        and(
          eq(channelOauthStates.stateHash, this.hashState(token)),
          eq(channelOauthStates.userId, session.user.id),
          eq(channelOauthStates.workspaceId, session.workspace.id),
        ),
      )
      .limit(1);

    if (!record) {
      throw new AppException('OAUTH_STATE_INVALID', HttpStatus.NOT_FOUND);
    }

    return {
      providerKey: record.providerKey,
      capabilityKey: record.capabilityKey,
      status: this.statusFor(record),
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  async validate(state: string): Promise<ValidatedChannelOAuthState> {
    const token = this.parseState(state);
    const [record] = await this.database.db
      .select()
      .from(channelOauthStates)
      .where(eq(channelOauthStates.stateHash, this.hashState(token)))
      .limit(1);

    if (!record) {
      throw new AppException('OAUTH_STATE_INVALID', HttpStatus.BAD_REQUEST);
    }

    this.assertUsable(record);
    return this.decrypt(record);
  }

  async consume(
    state: string,
    expectedProviderKey?: string,
  ): Promise<ValidatedChannelOAuthState> {
    const token = this.parseState(state);
    const predicates = [
      eq(channelOauthStates.stateHash, this.hashState(token)),
      gt(channelOauthStates.expiresAt, new Date()),
      isNull(channelOauthStates.consumedAt),
    ];
    if (expectedProviderKey) {
      predicates.push(eq(channelOauthStates.providerKey, expectedProviderKey));
    }

    const [record] = await this.database.db
      .update(channelOauthStates)
      .set({ consumedAt: new Date() })
      .where(and(...predicates))
      .returning();

    if (!record) {
      throw new AppException('OAUTH_STATE_INVALID', HttpStatus.BAD_REQUEST);
    }

    return this.decrypt(record);
  }

  private async assertReconnectAccount(
    session: PortalAuthSession,
    input: ChannelOAuthStart,
  ) {
    if (!input.reconnectAccountId) return;

    const [account] = await this.database.db
      .select({ id: socialAccounts.id })
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.id, input.reconnectAccountId),
          eq(socialAccounts.workspaceId, session.workspace.id),
          eq(socialAccounts.providerKey, input.providerKey),
          eq(socialAccounts.capabilityKey, input.capabilityKey),
        ),
      )
      .limit(1);

    if (!account) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
  }

  private decrypt(record: OAuthStateRow): ValidatedChannelOAuthState {
    if (!record.contextCiphertext || !record.pkceVerifierCiphertext) {
      throw new AppException('OAUTH_STATE_INVALID', HttpStatus.BAD_REQUEST);
    }

    const aad = this.aad(record);
    try {
      const context = channelOAuthContextSchema.safeParse(
        JSON.parse(
          this.encryption().decrypt(record.contextCiphertext, `${aad}:context`),
        ),
      );
      if (!context.success) throw new Error('Invalid OAuth context.');

      return {
        id: record.id,
        providerKey: record.providerKey,
        capabilityKey: record.capabilityKey,
        userId: record.userId,
        workspaceId: record.workspaceId,
        reconnectAccountId: record.reconnectAccountId,
        context: context.data,
        pkceVerifier: this.encryption().decrypt(
          record.pkceVerifierCiphertext,
          `${aad}:pkce`,
        ),
      };
    } catch {
      throw new AppException('OAUTH_STATE_INVALID', HttpStatus.BAD_REQUEST);
    }
  }

  private assertUsable(record: OAuthStateRow) {
    if (record.consumedAt) {
      throw new AppException('OAUTH_STATE_CONSUMED', HttpStatus.CONFLICT);
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new AppException('OAUTH_STATE_EXPIRED', HttpStatus.GONE);
    }
  }

  private statusFor(
    record: OAuthStateRow,
  ): ChannelOAuthStateResponse['status'] {
    if (record.consumedAt) return 'consumed';
    if (record.expiresAt.getTime() <= Date.now()) return 'expired';
    return 'pending';
  }

  private parseState(state: unknown) {
    const parsed = channelOAuthStateTokenSchema.safeParse(state);
    if (!parsed.success) {
      throw new AppException('OAUTH_STATE_INVALID', HttpStatus.BAD_REQUEST);
    }
    return parsed.data;
  }

  private encryption() {
    return new Aes256GcmService(
      this.config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'),
    );
  }

  private aad(
    record: Pick<
      OAuthStateRow,
      | 'id'
      | 'stateHash'
      | 'providerKey'
      | 'capabilityKey'
      | 'userId'
      | 'workspaceId'
    >,
  ) {
    return [
      'channel-oauth-state:v1',
      record.id,
      record.stateHash,
      record.providerKey,
      record.capabilityKey,
      record.userId,
      record.workspaceId,
    ].join(':');
  }

  private hashState(state: string) {
    return createHash('sha256').update(state).digest('hex');
  }

  private requireManager(session: PortalAuthSession) {
    if (!managerRoles.has(session.workspace.role)) {
      throw new AppException(
        'AUTH_WORKSPACE_UNAVAILABLE',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
