import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import {
  apiAuditLogs,
  automationWebhookDeliveries,
  automationWebhooks,
  createDatabase,
  publishingPosts,
  socialAccountMemberships,
  socialAccounts,
  users,
  workspaceMemberships,
  workspaces,
  type Database,
} from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import type { PortalAuthSession } from '@workspace/contracts';
import { AutomationEventsService } from '../automation/automation-events.service';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { TeamAccountAccessService } from '../teams/team-account-access.service';
import type { PublishingDeliveryJobData } from './publishing.constants';
import { PublishingService } from './publishing.service';

const databaseUrl = process.env.PUBLISHING_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();

const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback Publishing integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

function portalSession(
  userId: string,
  workspace: { id: string; name: string; slug: string },
  role: 'owner' | 'member',
): PortalAuthSession {
  return {
    area: 'portal',
    user: {
      displayName: `Publishing ${role}`,
      email: `publishing-${role}-${userId}@example.test`,
      id: userId,
    },
    workspace: { ...workspace, role },
  };
}

function queueThatFails(): Queue<PublishingDeliveryJobData> {
  return {
    add: () => Promise.reject(new Error('Queue unavailable in test.')),
  } as unknown as Queue<PublishingDeliveryJobData>;
}

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) {
    throw new Error('Local Publishing test database is unavailable.');
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

async function seedScenario(database: Database, suffix: string) {
  const ownerUserId = randomUUID();
  const memberUserId = randomUUID();
  const workspaceId = randomUUID();
  const membershipId = randomUUID();
  const grantedAccountId = randomUUID();
  const ungrantedAccountId = randomUUID();
  const now = new Date();
  const workspace = {
    id: workspaceId,
    name: `Publishing ${suffix}`,
    slug: `publishing-${suffix}-${workspaceId.slice(0, 8)}`,
  };

  await database.insert(users).values([
    {
      createdAt: now,
      displayName: `Publishing owner ${suffix}`,
      email: `publishing-owner-${suffix}-${ownerUserId}@example.test`,
      id: ownerUserId,
      updatedAt: now,
    },
    {
      createdAt: now,
      displayName: `Publishing member ${suffix}`,
      email: `publishing-member-${suffix}-${memberUserId}@example.test`,
      id: memberUserId,
      updatedAt: now,
    },
  ]);
  await database.insert(workspaces).values({
    ...workspace,
    createdAt: now,
    ownerUserId,
    updatedAt: now,
  });
  await database.insert(workspaceMemberships).values({
    createdAt: now,
    id: membershipId,
    joinedAt: now,
    role: 'member',
    status: 'active',
    updatedAt: now,
    userId: memberUserId,
    workspaceId,
  });
  await database.insert(socialAccounts).values([
    {
      capabilityKey: 'facebook_page',
      createdAt: now,
      displayName: `Granted Publishing ${suffix}`,
      id: grantedAccountId,
      providerKey: 'meta',
      updatedAt: now,
      workspaceId,
    },
    {
      capabilityKey: 'facebook_page',
      createdAt: now,
      displayName: `Ungranted Publishing ${suffix}`,
      id: ungrantedAccountId,
      providerKey: 'meta',
      updatedAt: now,
      workspaceId,
    },
  ]);
  await database.insert(socialAccountMemberships).values({
    createdAt: now,
    socialAccountId: grantedAccountId,
    updatedAt: now,
    workspaceMembershipId: membershipId,
  });

  return {
    grantedAccountId,
    memberSession: portalSession(memberUserId, workspace, 'member'),
    memberUserId,
    ownerSession: portalSession(ownerUserId, workspace, 'owner'),
    ownerUserId,
    ungrantedAccountId,
    workspaceId,
  };
}

function publishingService(database: Database) {
  const databaseService = { db: database } as DatabaseService;
  return new PublishingService(
    databaseService,
    new TeamAccountAccessService(databaseService),
    new AutomationEventsService(databaseService),
    queueThatFails(),
    new ConfigService({
      FILES_STORAGE_PATH: '/tmp',
      PROVIDER_INTEGRATIONS_ENCRYPTION_KEY: 'publishing-test-signing-key',
    }),
  );
}

describeDatabase('Publishing reliability', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('creates one post per account once for an idempotent operation', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedScenario(database, 'idempotency');
      const service = publishingService(database);
      const idempotencyKey = `publishing-${randomUUID()}`;
      await database.insert(automationWebhooks).values({
        createdByUserId: scenario.ownerUserId,
        events: ['post.created'],
        name: 'Publishing transactional webhook',
        signingSecretCiphertext: 'test-only-ciphertext',
        url: 'https://example.test/publishing-webhook',
        workspaceId: scenario.workspaceId,
      });
      const input = {
        accountIds: [scenario.grantedAccountId, scenario.ungrantedAccountId],
        content: 'Publish exactly once to both destinations.',
        idempotencyKey,
        mediaAssetIds: [],
        mode: 'now' as const,
      };

      const first = await service.create(scenario.ownerSession, input);
      const replay = await service.create(scenario.ownerSession, input);
      const rows = await database
        .select()
        .from(publishingPosts)
        .where(
          and(
            eq(publishingPosts.workspaceId, scenario.workspaceId),
            eq(publishingPosts.source, 'portal'),
            eq(publishingPosts.externalReference, idempotencyKey),
          ),
        );
      const audits = await database
        .select()
        .from(apiAuditLogs)
        .where(
          and(
            eq(apiAuditLogs.workspaceId, scenario.workspaceId),
            eq(apiAuditLogs.event, 'publishing.post_created'),
          ),
        );
      const deliveries = await database
        .select()
        .from(automationWebhookDeliveries)
        .where(
          and(
            eq(automationWebhookDeliveries.workspaceId, scenario.workspaceId),
            eq(automationWebhookDeliveries.event, 'post.created'),
          ),
        );

      expect(replay.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
      expect(rows).toHaveLength(2);
      expect(audits).toHaveLength(2);
      expect(deliveries).toHaveLength(2);
      expect(rows.every((row) => row.source === 'portal')).toBe(true);
      expect(
        rows.every((row) => row.externalReference === idempotencyKey),
      ).toBe(true);
      await expect(
        service.create(scenario.ownerSession, {
          ...input,
          accountIds: [scenario.grantedAccountId],
        }),
      ).rejects.toMatchObject({
        code: 'PUBLISHING_IDEMPOTENCY_CONFLICT',
      } satisfies Partial<AppException>);
    });
  });

  it('limits member reads to granted accounts and returns bounded metadata', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedScenario(database, 'grants');
      const now = new Date();
      await database.insert(publishingPosts).values([
        {
          authorUserId: scenario.memberUserId,
          content: 'Visible post',
          createdAt: now,
          socialAccountId: scenario.grantedAccountId,
          updatedAt: now,
          workspaceId: scenario.workspaceId,
        },
        {
          authorUserId: scenario.ownerUserId,
          content: 'Hidden post',
          createdAt: now,
          socialAccountId: scenario.ungrantedAccountId,
          updatedAt: now,
          workspaceId: scenario.workspaceId,
        },
      ]);

      const response = await publishingService(database).list(
        scenario.memberSession,
        { limit: 1, mediaLimit: 1, page: 1 },
      );

      expect(response.accounts.map(({ id }) => id)).toEqual([
        scenario.grantedAccountId,
      ]);
      expect(response.posts).toHaveLength(1);
      expect(response.posts[0]?.socialAccountId).toBe(
        scenario.grantedAccountId,
      );
      expect(response).toMatchObject({
        canManage: false,
        limit: 1,
        mediaLimit: 1,
        page: 1,
        total: 1,
      });
    });
  });

  it('does not expose retry for an unknown provider outcome', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedScenario(database, 'unknown-outcome');
      const [post] = await database
        .insert(publishingPosts)
        .values({
          authorUserId: scenario.ownerUserId,
          content: 'Provider response was ambiguous.',
          failureCode: 'PUBLISHING_PROVIDER_OUTCOME_UNKNOWN',
          socialAccountId: scenario.grantedAccountId,
          status: 'failed',
          workspaceId: scenario.workspaceId,
        })
        .returning({ id: publishingPosts.id });
      if (!post) throw new Error('Unable to seed unknown outcome post.');
      const service = publishingService(database);

      const response = await service.list(scenario.ownerSession);
      expect(response.posts.find(({ id }) => id === post.id)?.recoverable).toBe(
        false,
      );
      await expect(
        service.retry(scenario.ownerSession, post.id),
      ).rejects.toMatchObject({
        code: 'PUBLISHING_RETRY_OUTCOME_UNKNOWN',
      } satisfies Partial<AppException>);
    });
  });
});
