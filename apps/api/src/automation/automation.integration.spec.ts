import { createHash, randomUUID } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  automationApiKeys,
  automationLogs,
  automationWebhookDeliveries,
  createDatabase,
  socialAccounts,
  users,
  workspaces,
  type Database,
} from '@workspace/database';
import { eq } from '@workspace/database/query';
import type { PortalAuthSession } from '@workspace/contracts';
import type { FastifyRequest } from 'fastify';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { AutomationEventsService } from './automation-events.service';
import { AutomationService } from './automation.service';

const databaseUrl = process.env.PORTAL_AUTOMATION_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();

const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback Automation integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;
const encryptionKey = Buffer.alloc(32, 7).toString('base64');

function portalSession(
  userId: string,
  workspace: { id: string; name: string; slug: string },
  role = 'owner',
): PortalAuthSession {
  return {
    area: 'portal',
    user: {
      displayName: 'Automation test user',
      email: 'automation-test@example.test',
      id: userId,
    },
    workspace: { ...workspace, role },
  };
}

function externalRequest(token: string): FastifyRequest {
  return {
    headers: { authorization: `Bearer ${token}` },
    id: `automation-test-${randomUUID()}`,
  } as FastifyRequest;
}

function services(database: Database) {
  const databaseService = { db: database } as DatabaseService;
  const events = new AutomationEventsService(databaseService);
  const config = new ConfigService({
    PROVIDER_INTEGRATIONS_ENCRYPTION_KEY: encryptionKey,
  });
  const automation = new AutomationService(databaseService, events, config);
  return { automation, events };
}

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) {
    throw new Error('Local Automation test database is unavailable.');
  }
  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function seedWorkspace(database: Database, suffix: string) {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const now = new Date();
  await database.insert(users).values({
    createdAt: now,
    displayName: `Automation test ${suffix}`,
    email: `automation-${suffix}-${userId}@example.test`,
    id: userId,
    updatedAt: now,
  });
  await database.insert(workspaces).values({
    createdAt: now,
    id: workspaceId,
    name: `Automation workspace ${suffix}`,
    ownerUserId: userId,
    slug: `automation-${suffix}-${workspaceId.slice(0, 8)}`,
    updatedAt: now,
  });
  return {
    session: portalSession(userId, {
      id: workspaceId,
      name: `Automation workspace ${suffix}`,
      slug: `automation-${suffix}`,
    }),
    userId,
    workspaceId,
  };
}

async function seedAccount(
  database: Database,
  workspaceId: string,
  suffix: string,
) {
  const id = randomUUID();
  const now = new Date();
  await database.insert(socialAccounts).values({
    capabilityKey: 'facebook_page',
    createdAt: now,
    displayName: `Automation account ${suffix}`,
    id,
    providerKey: 'meta',
    updatedAt: now,
    workspaceId,
  });
  return id;
}

describeDatabase('Automation database contracts', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('stores only the API key hash and enforces permissions and workspace ownership', async () => {
    await inRollbackTransaction(async (database) => {
      const owner = await seedWorkspace(database, 'owner');
      const outsider = await seedWorkspace(database, 'outsider');
      const ownerAccountId = await seedAccount(
        database,
        owner.workspaceId,
        'owner',
      );
      await seedAccount(database, outsider.workspaceId, 'outsider');
      const { automation } = services(database);

      const created = await automation.createApiKey(owner.session, {
        name: 'Read accounts only',
        permissions: ['accounts:read'],
      });
      const [stored] = await database
        .select()
        .from(automationApiKeys)
        .where(eq(automationApiKeys.id, created.apiKey.id));

      expect(stored).toBeDefined();
      expect(stored?.tokenHash).toBe(
        createHash('sha256').update(created.token).digest('hex'),
      );
      expect(stored?.tokenHash).not.toBe(created.token);
      expect(stored?.tokenPrefix).toBe(created.token.slice(0, 16));
      expect(stored?.permissions).toEqual(['accounts:read']);

      const accounts = await automation.externalAccounts(
        externalRequest(created.token),
      );
      expect(accounts.map((account) => account.id)).toEqual([ownerAccountId]);

      await expect(
        automation.externalPosts(externalRequest(created.token)),
      ).rejects.toMatchObject({
        code: 'AUTOMATION_PERMISSION_REQUIRED',
      } satisfies Partial<AppException>);

      const logs = await database
        .select()
        .from(automationLogs)
        .where(eq(automationLogs.apiKeyId, created.apiKey.id));
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        direction: 'inbound',
        event: 'accounts.read',
        status: 'succeeded',
        statusCode: 200,
        workspaceId: owner.workspaceId,
      });
    });
  });

  it('does not let another workspace revoke an API key and requires a manager role', async () => {
    await inRollbackTransaction(async (database) => {
      const owner = await seedWorkspace(database, 'key-owner');
      const outsider = await seedWorkspace(database, 'key-outsider');
      const { automation } = services(database);
      const created = await automation.createApiKey(owner.session, {
        name: 'Owner key',
        permissions: ['posts:read'],
      });

      await expect(
        automation.revokeApiKey(outsider.session, created.apiKey.id),
      ).rejects.toMatchObject({
        code: 'AUTOMATION_API_KEY_NOT_FOUND',
      } satisfies Partial<AppException>);
      await expect(
        automation.createApiKey(
          {
            ...owner.session,
            workspace: { ...owner.session.workspace, role: 'member' },
          },
          { name: 'Forbidden key', permissions: ['posts:read'] },
        ),
      ).rejects.toMatchObject({
        code: 'AUTOMATION_MANAGE_FORBIDDEN',
      } satisfies Partial<AppException>);

      const [stored] = await database
        .select({ status: automationApiKeys.status })
        .from(automationApiKeys)
        .where(eq(automationApiKeys.id, created.apiKey.id));
      expect(stored?.status).toBe('active');

      try {
        await automation.revokeApiKey(outsider.session, created.apiKey.id);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });
  });

  it('creates one durable delivery per webhook and event subject across retries', async () => {
    await inRollbackTransaction(async (database) => {
      const owner = await seedWorkspace(database, 'webhooks');
      const outsider = await seedWorkspace(database, 'other-webhooks');
      const { automation, events } = services(database);
      const first = await automation.createWebhook(owner.session, {
        events: ['post.created'],
        name: 'Primary endpoint',
        url: 'https://hooks.example.test/primary',
      });
      const second = await automation.createWebhook(owner.session, {
        events: ['post.created'],
        name: 'Secondary endpoint',
        url: 'https://hooks.example.test/secondary',
      });
      await automation.createWebhook(outsider.session, {
        events: ['post.created'],
        name: 'Other workspace endpoint',
        url: 'https://hooks.example.test/other',
      });
      const subjectId = randomUUID();
      const event = {
        event: 'post.created' as const,
        payload: { status: 'scheduled' },
        subjectId,
        workspaceId: owner.workspaceId,
      };

      await events.emit(event);
      await events.emit(event);

      const ownerDeliveries = await database
        .select()
        .from(automationWebhookDeliveries)
        .where(eq(automationWebhookDeliveries.workspaceId, owner.workspaceId));
      const outsiderDeliveries = await database
        .select()
        .from(automationWebhookDeliveries)
        .where(
          eq(automationWebhookDeliveries.workspaceId, outsider.workspaceId),
        );

      expect(ownerDeliveries).toHaveLength(2);
      expect(
        new Set(ownerDeliveries.map((delivery) => delivery.webhookId)),
      ).toEqual(new Set([first.webhook.id, second.webhook.id]));
      expect(
        ownerDeliveries.every(
          (delivery) =>
            delivery.idempotencyKey === `post.created-${subjectId}` &&
            delivery.status === 'queued' &&
            delivery.attemptCount === 0,
        ),
      ).toBe(true);
      expect(outsiderDeliveries).toHaveLength(0);
    });
  });
});
