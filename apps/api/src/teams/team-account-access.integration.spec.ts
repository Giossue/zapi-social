import { randomUUID } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import {
  aiPublishingSchedules,
  aiPublishingScheduleTargets,
  aiRequests,
  createDatabase,
  publishingPosts,
  socialAccountMemberships,
  socialAccounts,
  users,
  workspaceMemberships,
  workspaces,
  type Database,
} from '@workspace/database';
import { eq } from '@workspace/database/query';
import {
  defaultPlanLimits,
  type PortalAuthSession,
} from '@workspace/contracts';
import type { AiRequestJobData } from '../ai/ai.constants';
import { AiService } from '../ai/ai.service';
import { AutomationEventsService } from '../automation/automation-events.service';
import type { ChannelProviderIntegrationsService } from '../integrations/channel-provider-integrations.service';
import { ChannelsService } from '../channels/channels.service';
import { WhatsAppStatusConnectionsService } from '../channels/whatsapp-status-connections.service';
import { DatabaseService } from '../database/database.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { AppException } from '../platform/errors/app-exception';
import type { PublishingDeliveryJobData } from '../publishing/publishing.constants';
import { PublishingService } from '../publishing/publishing.service';
import { PlanAccessService } from '../plans/plan-access.service';
import { TeamAccountAccessService } from './team-account-access.service';

const databaseUrl = process.env.TEAM_ACCOUNT_ACCESS_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();

const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback Team account access integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

function portalSession(
  userId: string,
  workspace: { id: string; name: string; slug: string },
  role: 'owner' | 'admin' | 'member',
): PortalAuthSession {
  return {
    area: 'portal',
    user: {
      displayName: `Account access ${role}`,
      email: `${role}-${userId}@example.test`,
      id: userId,
      locale: null,
    },
    workspace: { ...workspace, role },
    workspaces: [{ ...workspace, role }],
  };
}

function fakeEvents(): AutomationEventsService {
  return {
    emit: () => Promise.resolve(),
    emitInTransaction: () => Promise.resolve(),
  } as unknown as AutomationEventsService;
}

function fakeQueue<T>(): Queue<T> {
  return {
    add: () => Promise.resolve({ id: `test-job-${randomUUID()}` }),
  } as unknown as Queue<T>;
}

function fakeIntegrations(): IntegrationsService {
  const offline = {
    enabled: false,
    readiness: 'not_configured',
    capabilities: [],
  };
  return {
    getMeta: () => Promise.resolve(offline),
    getWhatsAppStatus: () => Promise.resolve(offline),
  } as unknown as IntegrationsService;
}

function permissivePlanAccess(): PlanAccessService {
  return {
    availableChannelCapabilities: (_workspaceId: string, keys: string[]) =>
      Promise.resolve(new Set(keys)),
    limitsFor: () => Promise.resolve(defaultPlanLimits),
    requireModule: () => Promise.resolve(),
    requirePostSlot: () => Promise.resolve(),
  } as unknown as PlanAccessService;
}

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) {
    throw new Error('Local Team account access database is unavailable.');
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

async function seedAccessScenario(database: Database, suffix: string) {
  const ownerUserId = randomUUID();
  const memberUserId = randomUUID();
  const workspaceId = randomUUID();
  const membershipId = randomUUID();
  const grantedAccountId = randomUUID();
  const ungrantedAccountId = randomUUID();
  const now = new Date();
  const workspace = {
    id: workspaceId,
    name: `Account access ${suffix}`,
    slug: `account-access-${suffix}-${workspaceId.slice(0, 8)}`,
  };

  await database.insert(users).values([
    {
      createdAt: now,
      displayName: `Account access owner ${suffix}`,
      email: `account-owner-${suffix}-${ownerUserId}@example.test`,
      id: ownerUserId,
      updatedAt: now,
    },
    {
      createdAt: now,
      displayName: `Account access member ${suffix}`,
      email: `account-member-${suffix}-${memberUserId}@example.test`,
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
      displayName: `Granted account ${suffix}`,
      id: grantedAccountId,
      providerKey: 'meta',
      updatedAt: now,
      workspaceId,
    },
    {
      capabilityKey: 'facebook_page',
      createdAt: now,
      displayName: `Ungranted account ${suffix}`,
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
    membershipId,
    ownerSession: portalSession(ownerUserId, workspace, 'owner'),
    ownerUserId,
    ungrantedAccountId,
    workspaceId,
  };
}

describeDatabase('Team account access policy', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('gives owners and admins full scope and members only active grants', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedAccessScenario(database, 'policy');
      const access = new TeamAccountAccessService({
        db: database,
      } as DatabaseService);

      const ownerScope = await access.resolve(scenario.ownerSession);
      const adminScope = await access.resolve({
        ...scenario.memberSession,
        workspace: { ...scenario.memberSession.workspace, role: 'admin' },
      });
      const memberScope = await access.resolve(scenario.memberSession);

      expect(ownerScope.unrestricted).toBe(true);
      expect(adminScope.unrestricted).toBe(true);
      expect(access.allows(memberScope, scenario.grantedAccountId)).toBe(true);
      expect(access.allows(memberScope, scenario.ungrantedAccountId)).toBe(
        false,
      );

      await database
        .update(workspaceMemberships)
        .set({ status: 'inactive', updatedAt: new Date() })
        .where(eq(workspaceMemberships.id, scenario.membershipId));
      const inactiveScope = await access.resolve(scenario.memberSession);
      expect(inactiveScope.unrestricted).toBe(false);
      expect(inactiveScope.accountIds.size).toBe(0);
    });
  });

  it('filters Publishing accounts and posts to the member grants', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedAccessScenario(database, 'publishing');
      const now = new Date();
      const [grantedPost, ungrantedPost] = await database
        .insert(publishingPosts)
        .values([
          {
            authorUserId: scenario.memberUserId,
            content: 'Granted publishing post',
            createdAt: now,
            socialAccountId: scenario.grantedAccountId,
            updatedAt: now,
            workspaceId: scenario.workspaceId,
          },
          {
            authorUserId: scenario.ownerUserId,
            content: 'Ungranted publishing post',
            createdAt: now,
            socialAccountId: scenario.ungrantedAccountId,
            updatedAt: now,
            workspaceId: scenario.workspaceId,
          },
        ])
        .returning({ id: publishingPosts.id });
      const databaseService = { db: database } as DatabaseService;
      const access = new TeamAccountAccessService(databaseService);
      const service = new PublishingService(
        databaseService,
        access,
        fakeEvents(),
        permissivePlanAccess(),
        fakeQueue<PublishingDeliveryJobData>(),
        new ConfigService({
          FILES_STORAGE_PATH: '/tmp',
          PROVIDER_INTEGRATIONS_ENCRYPTION_KEY: 'test-signing-key',
        }),
      );

      const memberView = await service.list(scenario.memberSession);
      const ownerView = await service.list(scenario.ownerSession);

      expect(memberView.accounts.map(({ id }) => id)).toEqual([
        scenario.grantedAccountId,
      ]);
      expect(memberView.posts.map(({ id }) => id)).toEqual([grantedPost?.id]);
      expect(ownerView.accounts.map(({ id }) => id).sort()).toEqual(
        [scenario.grantedAccountId, scenario.ungrantedAccountId].sort(),
      );
      expect(ownerView.posts.map(({ id }) => id).sort()).toEqual(
        [grantedPost?.id, ungrantedPost?.id].sort(),
      );
    });
  });

  it('filters Channels inventory and totals to the member grants', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedAccessScenario(database, 'channels');
      const databaseService = { db: database } as DatabaseService;
      const access = new TeamAccountAccessService(databaseService);
      const service = new ChannelsService(
        databaseService,
        fakeIntegrations(),
        {
          readyCapabilityKeys: () => Promise.resolve([]),
        } as unknown as ChannelProviderIntegrationsService,
        {} as WhatsAppStatusConnectionsService,
        access,
        permissivePlanAccess(),
      );

      const memberView = await service.list(scenario.memberSession, {});
      const ownerView = await service.list(scenario.ownerSession, {});

      expect(memberView.accounts.map(({ id }) => id)).toEqual([
        scenario.grantedAccountId,
      ]);
      expect(memberView.summary.total).toBe(1);
      expect(ownerView.accounts.map(({ id }) => id).sort()).toEqual(
        [scenario.grantedAccountId, scenario.ungrantedAccountId].sort(),
      );
      expect(ownerView.summary.total).toBe(2);
    });
  });

  it('protects AI draft destinations and hides ungranted schedule targets', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedAccessScenario(database, 'ai');
      const now = new Date();
      const [request] = await database
        .insert(aiRequests)
        .values({
          completedAt: now,
          idempotencyKey: `account-access-${randomUUID()}`,
          input: {},
          kind: 'content',
          prompt: 'Create a secure draft.',
          requestedByUserId: scenario.memberUserId,
          result: { text: 'A draft visible only on granted accounts.' },
          status: 'succeeded',
          workspaceId: scenario.workspaceId,
        })
        .returning({ id: aiRequests.id });
      const [schedule] = await database
        .insert(aiPublishingSchedules)
        .values({
          createdByUserId: scenario.ownerUserId,
          name: 'Account access schedule',
          preferredTime: '09:00',
          prompt: 'Create a scheduled draft.',
          timezone: 'America/Guayaquil',
          workspaceId: scenario.workspaceId,
        })
        .returning({ id: aiPublishingSchedules.id });
      if (!request || !schedule) {
        throw new Error('Unable to seed AI account access test.');
      }
      await database.insert(aiPublishingScheduleTargets).values([
        {
          scheduleId: schedule.id,
          socialAccountId: scenario.grantedAccountId,
          workspaceId: scenario.workspaceId,
        },
        {
          scheduleId: schedule.id,
          socialAccountId: scenario.ungrantedAccountId,
          workspaceId: scenario.workspaceId,
        },
      ]);
      const databaseService = { db: database } as DatabaseService;
      const service = new AiService(
        databaseService,
        new TeamAccountAccessService(databaseService),
        fakeEvents(),
        permissivePlanAccess(),
        fakeQueue<AiRequestJobData>(),
      );

      await expect(
        service.useAsDraft(scenario.memberSession, request.id, {
          mediaAssetIds: [],
          socialAccountIds: [scenario.ungrantedAccountId],
        }),
      ).rejects.toMatchObject({
        code: 'AI_DRAFT_RESOURCE_NOT_AVAILABLE',
      } satisfies Partial<AppException>);

      const draft = await service.useAsDraft(
        scenario.memberSession,
        request.id,
        {
          mediaAssetIds: [],
          socialAccountIds: [scenario.grantedAccountId],
        },
      );
      const [post] = await database
        .select()
        .from(publishingPosts)
        .where(eq(publishingPosts.id, draft.publishingPostIds[0]));
      const [memberSchedule] = await service.listSchedules(
        scenario.memberSession,
      );
      const [ownerSchedule] = await service.listSchedules(
        scenario.ownerSession,
      );

      expect(post?.socialAccountId).toBe(scenario.grantedAccountId);
      expect(memberSchedule?.targetSocialAccountIds).toEqual([
        scenario.grantedAccountId,
      ]);
      expect(ownerSchedule?.targetSocialAccountIds.sort()).toEqual(
        [scenario.grantedAccountId, scenario.ungrantedAccountId].sort(),
      );
    });
  });

  it('cancels only AI requests that are still queued', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedAccessScenario(database, 'ai-cancel');
      const [processing, queued] = await database
        .insert(aiRequests)
        .values([
          {
            costUnits: 1,
            idempotencyKey: `processing-${randomUUID()}`,
            input: {},
            kind: 'content',
            prompt: 'Already claimed by the worker.',
            requestedByUserId: scenario.memberUserId,
            status: 'processing',
            workspaceId: scenario.workspaceId,
          },
          {
            costUnits: 1,
            idempotencyKey: `queued-${randomUUID()}`,
            input: {},
            kind: 'content',
            prompt: 'Still safe to cancel.',
            requestedByUserId: scenario.memberUserId,
            status: 'queued',
            workspaceId: scenario.workspaceId,
          },
        ])
        .returning({ id: aiRequests.id });
      if (!processing || !queued) {
        throw new Error('Unable to seed AI cancellation test.');
      }
      const databaseService = { db: database } as DatabaseService;
      const service = new AiService(
        databaseService,
        new TeamAccountAccessService(databaseService),
        fakeEvents(),
        permissivePlanAccess(),
        fakeQueue<AiRequestJobData>(),
      );

      await expect(
        service.cancelRequest(scenario.memberSession, processing.id),
      ).rejects.toMatchObject({
        code: 'AI_REQUEST_NOT_CANCELLABLE',
      } satisfies Partial<AppException>);
      const cancelled = await service.cancelRequest(
        scenario.memberSession,
        queued.id,
      );
      const [unchanged] = await database
        .select({ status: aiRequests.status })
        .from(aiRequests)
        .where(eq(aiRequests.id, processing.id));

      expect(cancelled.status).toBe('cancelled');
      expect(unchanged?.status).toBe('processing');
    });
  });

  it('rate limits new AI requests but preserves idempotent retries', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedAccessScenario(database, 'ai-rate-limit');
      const now = new Date();
      const existingKey = `existing-${randomUUID()}`;
      const inserted = await database
        .insert(aiRequests)
        .values(
          Array.from({ length: 10 }, (_, index) => ({
            createdAt: now,
            idempotencyKey:
              index === 0 ? existingKey : `rate-limit-${index}-${randomUUID()}`,
            input: {},
            kind: 'content' as const,
            prompt: 'Recent AI request.',
            requestedByUserId: scenario.memberUserId,
            workspaceId: scenario.workspaceId,
          })),
        )
        .returning({ id: aiRequests.id });
      const databaseService = { db: database } as DatabaseService;
      const service = new AiService(
        databaseService,
        new TeamAccountAccessService(databaseService),
        fakeEvents(),
        permissivePlanAccess(),
        fakeQueue<AiRequestJobData>(),
      );

      const idempotent = await service.createRequest(scenario.memberSession, {
        idempotencyKey: existingKey,
        input: {},
        kind: 'content',
        prompt: 'Recent AI request.',
      });
      expect(idempotent.id).toBe(inserted[0]?.id);

      try {
        await service.createRequest(scenario.memberSession, {
          idempotencyKey: `blocked-${randomUUID()}`,
          input: {},
          kind: 'content',
          prompt: 'This request must be rate limited.',
        });
        throw new Error('Expected the AI request rate limit.');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe('AI_REQUEST_RATE_LIMITED');
        expect((error as AppException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    });
  });
});
