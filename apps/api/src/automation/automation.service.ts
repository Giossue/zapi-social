import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  apiAuditLogs,
  automationApiKeys,
  automationLogs,
  automationWebhooks,
  fileAssets,
  publishingPostMedia,
  publishingPosts,
  socialAccounts,
} from '@workspace/database';
import { and, desc, eq, inArray } from '@workspace/database/query';
import {
  automationCreatePostsSchema,
  createPortalAutomationApiKeySchema,
  createPortalAutomationWebhookSchema,
  updatePortalAutomationWebhookSchema,
  type AutomationPermission,
  type AutomationWebhookEvent,
  type AutomationPost,
  type PortalAuthSession,
  type PortalAutomationResponse,
} from '@workspace/contracts';
import type { FastifyRequest } from 'fastify';
import { DatabaseService } from '../database/database.service';
import {
  AppException,
  type AppErrorCode,
} from '../platform/errors/app-exception';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { AutomationEventsService } from './automation-events.service';

const managerRoles = new Set(['owner', 'admin']);

@Injectable()
export class AutomationService {
  private readonly encryption: Aes256GcmService;
  private readonly production: boolean;

  constructor(
    private readonly database: DatabaseService,
    private readonly events: AutomationEventsService,
    config: ConfigService,
  ) {
    this.encryption = new Aes256GcmService(
      config.getOrThrow<string>('PROVIDER_INTEGRATIONS_ENCRYPTION_KEY'),
    );
    this.production = config.get<string>('NODE_ENV') === 'production';
  }

  async getPortal(
    session: PortalAuthSession,
  ): Promise<PortalAutomationResponse> {
    const [apiKeys, webhooks, logs] = await Promise.all([
      this.database.db
        .select()
        .from(automationApiKeys)
        .where(eq(automationApiKeys.workspaceId, session.workspace.id))
        .orderBy(desc(automationApiKeys.createdAt)),
      this.database.db
        .select()
        .from(automationWebhooks)
        .where(eq(automationWebhooks.workspaceId, session.workspace.id))
        .orderBy(desc(automationWebhooks.createdAt)),
      this.database.db
        .select()
        .from(automationLogs)
        .where(eq(automationLogs.workspaceId, session.workspace.id))
        .orderBy(desc(automationLogs.createdAt))
        .limit(100),
    ]);
    return {
      canManage: managerRoles.has(session.workspace.role),
      apiKeys: apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        tokenPrefix: key.tokenPrefix,
        permissions: key.permissions as AutomationPermission[],
        status: key.status,
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        expiresAt: key.expiresAt?.toISOString() ?? null,
        createdAt: key.createdAt.toISOString(),
      })),
      webhooks: webhooks.map((webhook) => this.serializeWebhook(webhook)),
      logs: logs.map((log) => ({
        id: log.id,
        direction: log.direction,
        event: log.event,
        status: log.status,
        statusCode: log.statusCode,
        summary: log.summary,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  async createApiKey(session: PortalAuthSession, input: unknown) {
    this.requireManage(session);
    const parsed = createPortalAutomationApiKeySchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const expiresAt = parsed.data.expiresAt
      ? new Date(parsed.data.expiresAt)
      : null;
    if (expiresAt && expiresAt <= new Date()) throw this.invalid();
    const token = `zapi_live_${randomBytes(32).toString('base64url')}`;
    const now = new Date();
    const [key] = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(automationApiKeys)
        .values({
          workspaceId: session.workspace.id,
          createdByUserId: session.user.id,
          name: parsed.data.name,
          tokenPrefix: token.slice(0, 16),
          tokenHash: this.hash(token),
          permissions: parsed.data.permissions,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw this.failed();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'automation.api_key_created',
        subjectType: 'automation_api_key',
        subjectId: created.id,
        metadata: { permissions: created.permissions },
      });
      return [created];
    });
    if (!key) throw this.failed();
    return {
      apiKey: {
        id: key.id,
        name: key.name,
        tokenPrefix: key.tokenPrefix,
        permissions: key.permissions,
        status: key.status,
        lastUsedAt: null,
        expiresAt: key.expiresAt?.toISOString() ?? null,
        createdAt: key.createdAt.toISOString(),
      },
      token,
    };
  }

  async revokeApiKey(session: PortalAuthSession, id: string) {
    this.requireManage(session);
    const keyId = this.parseId(id, 'AUTOMATION_API_KEY_NOT_FOUND');
    const now = new Date();
    const [key] = await this.database.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(automationApiKeys)
        .set({ status: 'revoked', revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(automationApiKeys.id, keyId),
            eq(automationApiKeys.workspaceId, session.workspace.id),
          ),
        )
        .returning({ id: automationApiKeys.id });
      if (!updated) {
        throw new AppException(
          'AUTOMATION_API_KEY_NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'automation.api_key_revoked',
        subjectType: 'automation_api_key',
        subjectId: keyId,
        metadata: {},
      });
      return [updated];
    });
    return key;
  }

  async createWebhook(session: PortalAuthSession, input: unknown) {
    this.requireManage(session);
    const parsed = createPortalAutomationWebhookSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    this.requireWebhookProtocol(parsed.data.url);
    const secret = randomBytes(32).toString('base64url');
    const now = new Date();
    const [webhook] = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(automationWebhooks)
        .values({
          workspaceId: session.workspace.id,
          createdByUserId: session.user.id,
          name: parsed.data.name,
          url: parsed.data.url,
          signingSecretCiphertext: this.encryption.encrypt(
            secret,
            this.webhookContext(session.workspace.id),
          ),
          events: parsed.data.events,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw this.failed();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'automation.webhook_created',
        subjectType: 'automation_webhook',
        subjectId: created.id,
        metadata: { events: created.events },
      });
      return [created];
    });
    if (!webhook) throw this.failed();
    return { webhook: this.serializeWebhook(webhook), signingSecret: secret };
  }

  async updateWebhook(session: PortalAuthSession, id: string, input: unknown) {
    this.requireManage(session);
    const webhookId = this.parseId(id, 'AUTOMATION_WEBHOOK_NOT_FOUND');
    const parsed = updatePortalAutomationWebhookSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    if (parsed.data.url) this.requireWebhookProtocol(parsed.data.url);
    const secret = parsed.data.rotateSecret
      ? randomBytes(32).toString('base64url')
      : null;
    const changes = { ...parsed.data };
    delete changes.rotateSecret;
    const now = new Date();
    const [webhook] = await this.database.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(automationWebhooks)
        .set({
          ...changes,
          ...(secret
            ? {
                signingSecretCiphertext: this.encryption.encrypt(
                  secret,
                  this.webhookContext(session.workspace.id),
                ),
              }
            : {}),
          updatedAt: now,
        })
        .where(
          and(
            eq(automationWebhooks.id, webhookId),
            eq(automationWebhooks.workspaceId, session.workspace.id),
          ),
        )
        .returning();
      if (!updated) {
        throw new AppException(
          'AUTOMATION_WEBHOOK_NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'automation.webhook_updated',
        subjectType: 'automation_webhook',
        subjectId: webhookId,
        metadata: { changedFields: Object.keys(parsed.data) },
      });
      return [updated];
    });
    if (!webhook) throw this.failed();
    return { webhook: this.serializeWebhook(webhook), signingSecret: secret };
  }

  async removeWebhook(session: PortalAuthSession, id: string) {
    this.requireManage(session);
    const webhookId = this.parseId(id, 'AUTOMATION_WEBHOOK_NOT_FOUND');
    await this.database.db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(automationWebhooks)
        .where(
          and(
            eq(automationWebhooks.id, webhookId),
            eq(automationWebhooks.workspaceId, session.workspace.id),
          ),
        )
        .returning({ id: automationWebhooks.id });
      if (!removed) {
        throw new AppException(
          'AUTOMATION_WEBHOOK_NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'automation.webhook_deleted',
        subjectType: 'automation_webhook',
        subjectId: webhookId,
        metadata: {},
      });
    });
  }

  async externalIdentity(request: FastifyRequest) {
    const auth = await this.authenticate(request);
    await this.logInbound(auth, request, 'identity.read', 200);
    return { workspaceId: auth.key.workspaceId, permissions: auth.permissions };
  }

  async externalAccounts(request: FastifyRequest) {
    const auth = await this.authenticate(request, 'accounts:read');
    const accounts = await this.database.db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, auth.key.workspaceId),
          eq(socialAccounts.status, 'active'),
        ),
      )
      .orderBy(socialAccounts.displayName);
    await this.logInbound(auth, request, 'accounts.read', 200, {
      count: accounts.length,
    });
    return accounts.map((account) => ({
      id: account.id,
      displayName: account.displayName,
      providerKey: account.providerKey,
      capabilityKey: account.capabilityKey,
      avatarUrl: account.avatarUrl,
      status: account.status,
    }));
  }

  async externalPosts(request: FastifyRequest): Promise<AutomationPost[]> {
    const auth = await this.authenticate(request, 'posts:read');
    const posts = await this.database.db
      .select()
      .from(publishingPosts)
      .where(eq(publishingPosts.workspaceId, auth.key.workspaceId))
      .orderBy(desc(publishingPosts.createdAt))
      .limit(100);
    await this.logInbound(auth, request, 'posts.read', 200, {
      count: posts.length,
    });
    return posts
      .filter((post) => post.socialAccountId !== null)
      .map((post) => this.serializePost(post));
  }

  async externalCreatePosts(request: FastifyRequest, input: unknown) {
    const auth = await this.authenticate(request, 'posts:write');
    const parsed = automationCreatePostsSchema.safeParse(input);
    if (!parsed.success) {
      await this.logInbound(auth, request, 'posts.create', 400);
      throw this.invalid();
    }
    const [accounts, media] = await Promise.all([
      this.database.db
        .select({ id: socialAccounts.id })
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.workspaceId, auth.key.workspaceId),
            eq(socialAccounts.status, 'active'),
            inArray(socialAccounts.id, parsed.data.accountIds),
          ),
        ),
      parsed.data.fileAssetIds.length
        ? this.database.db
            .select({ id: fileAssets.id })
            .from(fileAssets)
            .where(
              and(
                eq(fileAssets.workspaceId, auth.key.workspaceId),
                eq(fileAssets.status, 'ready'),
                inArray(fileAssets.id, parsed.data.fileAssetIds),
              ),
            )
        : Promise.resolve([]),
    ]);
    if (
      accounts.length !== parsed.data.accountIds.length ||
      media.length !== parsed.data.fileAssetIds.length
    ) {
      await this.logInbound(auth, request, 'posts.create', 422);
      throw new AppException(
        'AUTOMATION_RESOURCE_NOT_AVAILABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const scheduledAt =
      parsed.data.mode === 'draft'
        ? null
        : parsed.data.mode === 'publish_now'
          ? new Date()
          : new Date(parsed.data.scheduledAt!);
    const created: AutomationPost[] = [];
    for (const account of accounts) {
      const post = await this.database.db.transaction(async (tx) => {
        if (parsed.data.externalReference) {
          const [existing] = await tx
            .select()
            .from(publishingPosts)
            .where(
              and(
                eq(publishingPosts.workspaceId, auth.key.workspaceId),
                eq(publishingPosts.source, 'automation'),
                eq(
                  publishingPosts.externalReference,
                  parsed.data.externalReference,
                ),
                eq(publishingPosts.socialAccountId, account.id),
              ),
            )
            .limit(1);
          if (existing) return existing;
        }
        const [inserted] = await tx
          .insert(publishingPosts)
          .values({
            workspaceId: auth.key.workspaceId,
            authorUserId: auth.key.createdByUserId,
            socialAccountId: account.id,
            status: parsed.data.mode === 'draft' ? 'draft' : 'scheduled',
            content: parsed.data.content,
            scheduledAt,
            source: 'automation',
            externalReference: parsed.data.externalReference ?? null,
          })
          .returning();
        if (!inserted) throw this.failed();
        if (parsed.data.fileAssetIds.length) {
          await tx.insert(publishingPostMedia).values(
            parsed.data.fileAssetIds.map((fileAssetId, position) => ({
              publishingPostId: inserted.id,
              fileAssetId,
              workspaceId: auth.key.workspaceId,
              position,
            })),
          );
        }
        await this.events.emitInTransaction(tx, {
          workspaceId: auth.key.workspaceId,
          event: 'post.created',
          subjectId: inserted.id,
          payload: this.serializePost(inserted),
        });
        return inserted;
      });
      created.push(this.serializePost(post));
    }
    await this.logInbound(auth, request, 'posts.create', 201, {
      count: created.length,
    });
    return created;
  }

  private async authenticate(
    request: FastifyRequest,
    permission?: AutomationPermission,
  ) {
    const authorization = request.headers.authorization;
    const headerToken = request.headers['x-api-key'];
    const token =
      typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : typeof headerToken === 'string'
          ? headerToken.trim()
          : '';
    if (!token) throw this.unauthorized();
    const [key] = await this.database.db
      .select()
      .from(automationApiKeys)
      .where(
        and(
          eq(automationApiKeys.tokenHash, this.hash(token)),
          eq(automationApiKeys.status, 'active'),
        ),
      )
      .limit(1);
    if (!key || (key.expiresAt && key.expiresAt <= new Date())) {
      throw this.unauthorized();
    }
    const permissions = key.permissions as AutomationPermission[];
    if (permission && !permissions.includes(permission)) {
      throw new AppException(
        'AUTOMATION_PERMISSION_REQUIRED',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.database.db
      .update(automationApiKeys)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(automationApiKeys.id, key.id));
    return { key, permissions };
  }

  private async logInbound(
    auth: { key: typeof automationApiKeys.$inferSelect },
    request: FastifyRequest,
    event: string,
    statusCode: number,
    metadata: Record<string, unknown> = {},
  ) {
    const requestId = request.id ? String(request.id) : null;
    await this.database.db.insert(automationLogs).values({
      workspaceId: auth.key.workspaceId,
      apiKeyId: auth.key.id,
      direction: 'inbound',
      event,
      requestId,
      status: statusCode >= 400 ? 'failed' : 'succeeded',
      statusCode,
      metadata,
    });
  }

  private serializeWebhook(webhook: typeof automationWebhooks.$inferSelect) {
    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events as AutomationWebhookEvent[],
      enabled: webhook.enabled,
      lastSentAt: webhook.lastSentAt?.toISOString() ?? null,
      lastStatusCode: webhook.lastStatusCode,
      createdAt: webhook.createdAt.toISOString(),
    };
  }

  private serializePost(
    post: typeof publishingPosts.$inferSelect,
  ): AutomationPost {
    return {
      id: post.id,
      socialAccountId: post.socialAccountId!,
      status: post.status,
      scheduledAt: post.scheduledAt?.toISOString() ?? null,
    };
  }

  private requireWebhookProtocol(value: string) {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (this.production && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.hostname.toLowerCase() === 'localhost' ||
      (isIP(url.hostname) > 0 && privateLiteralAddress(url.hostname))
    ) {
      throw this.invalid();
    }
  }

  private requireManage(session: PortalAuthSession) {
    if (!managerRoles.has(session.workspace.role)) {
      throw new AppException(
        'AUTOMATION_MANAGE_FORBIDDEN',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private webhookContext(workspaceId: string) {
    return `automation-webhook:${workspaceId}`;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private parseId(value: string, code: AppErrorCode) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      throw new AppException(code, HttpStatus.NOT_FOUND);
    }
    return value;
  }

  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private unauthorized() {
    return new AppException(
      'AUTOMATION_API_KEY_INVALID',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private failed() {
    return new AppException(
      'AUTOMATION_REQUEST_FAILED',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

function privateLiteralAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [first = 0, second = 0] = address.split('.').map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first >= 224
    );
  }
  const normalized = address.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    (normalized.startsWith('::ffff:') &&
      privateLiteralAddress(normalized.slice('::ffff:'.length)))
  );
}
