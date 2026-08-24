import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import {
  aiRequests,
  aiModelRoutes,
  commerceInventoryLevels,
  createDatabase,
  creditLedgerEntries,
  plans,
  socialAccounts,
  users,
  workspaceCreditAccounts,
  workspacePlanAssignments,
  workspaces,
  type Database,
} from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import {
  defaultPlanLimits,
  type PortalAuthSession,
} from '@workspace/contracts';
import type { AiRequestJobData } from './ai/ai.constants';
import { PlanAccessService } from './plans/plan-access.service';
import { AiService } from './ai/ai.service';
import { AutomationEventsService } from './automation/automation-events.service';
import { CommerceService } from './commerce/commerce.service';
import { DatabaseService } from './database/database.service';
import { GroupsService } from './groups/groups.service';
import { AppException } from './platform/errors/app-exception';
import { TeamAccountAccessService } from './teams/team-account-access.service';

const databaseUrl = process.env.PORTAL_BACKEND_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();

const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback Portal backend integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

function portalSession(
  userId: string,
  workspace: { id: string; name: string; slug: string },
): PortalAuthSession {
  return {
    area: 'portal',
    user: {
      displayName: 'Portal backend test user',
      email: 'portal-backend-test@example.test',
      id: userId,
      locale: null,
    },
    workspace: { ...workspace, role: 'owner' },
    workspaces: [{ ...workspace, role: 'owner' }],
  };
}

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection)
    throw new Error('Local Portal test database is unavailable.');
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
    displayName: `Portal backend ${suffix}`,
    email: `portal-${suffix}-${userId}@example.test`,
    id: userId,
    updatedAt: now,
  });
  await database.insert(workspaces).values({
    createdAt: now,
    id: workspaceId,
    name: `Portal workspace ${suffix}`,
    ownerUserId: userId,
    slug: `portal-${suffix}-${workspaceId.slice(0, 8)}`,
    updatedAt: now,
  });
  return {
    session: portalSession(userId, {
      id: workspaceId,
      name: `Portal workspace ${suffix}`,
      slug: `portal-${suffix}`,
    }),
    userId,
    workspaceId,
  };
}

async function seedSocialAccount(database: Database, workspaceId: string) {
  const id = randomUUID();
  await database.insert(socialAccounts).values({
    capabilityKey: 'facebook_page',
    displayName: 'Portal backend channel',
    id,
    providerKey: 'meta',
    workspaceId,
  });
  return id;
}

describeDatabase('Portal backend v2 database contracts', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('keeps account groups isolated by workspace', async () => {
    await inRollbackTransaction(async (database) => {
      const owner = await seedWorkspace(database, 'groups-owner');
      const outsider = await seedWorkspace(database, 'groups-outsider');
      const accountId = await seedSocialAccount(database, owner.workspaceId);
      const service = new GroupsService({ db: database } as DatabaseService);

      const group = await service.create(owner.session, {
        accountIds: [accountId],
        color: '#2563eb',
        description: 'Private account group',
        name: 'Private group',
        status: 'active',
      });
      const outsiderGroups = await service.list(outsider.session, {});

      expect(outsiderGroups.groups).toHaveLength(0);
      await expect(
        service.remove(outsider.session, group.id),
      ).rejects.toMatchObject({
        code: 'GROUP_NOT_FOUND',
      } satisfies Partial<AppException>);
    });
  });

  it('reserves inventory once and consumes it on order completion', async () => {
    await inRollbackTransaction(async (database) => {
      const owner = await seedWorkspace(database, 'commerce');
      const service = new CommerceService({ db: database } as DatabaseService);
      const product = await service.createProduct(owner.session, {
        available: 10,
        description: 'Inventory integration test',
        lowStockThreshold: 2,
        name: 'Test product',
        reserved: 0,
        sku: 'TEST-001',
        status: 'active',
      });
      const order = await service.createOrder(owner.session, {
        channel: 'store',
        currency: 'USD',
        customerEmail: 'buyer@example.test',
        customerName: 'Test buyer',
        items: [
          {
            name: product.name,
            productId: product.id,
            quantity: 3,
            sku: product.sku,
            unitPriceMinor: 500,
          },
        ],
      });
      const [reserved] = await database
        .select()
        .from(commerceInventoryLevels)
        .where(eq(commerceInventoryLevels.productId, product.id));

      expect(reserved).toMatchObject({ available: 10, reserved: 3 });
      await service.updateOrder(owner.session, order.id, {
        status: 'completed',
      });
      const [completed] = await database
        .select()
        .from(commerceInventoryLevels)
        .where(eq(commerceInventoryLevels.productId, product.id));

      expect(completed).toMatchObject({ available: 7, reserved: 0 });
      await expect(
        service.updateOrder(owner.session, order.id, { status: 'cancelled' }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      } satisfies Partial<AppException>);
    });
  });

  it('charges an idempotent AI request only once', async () => {
    await inRollbackTransaction(async (database) => {
      const owner = await seedWorkspace(database, 'ai');
      await database.insert(workspaceCreditAccounts).values({
        balanceUnits: 10,
        unlimited: false,
        workspaceId: owner.workspaceId,
      });
      const [plan] = await database
        .insert(plans)
        .values({
          createdByUserId: owner.userId,
          limits: {
            ...defaultPlanLimits,
            creditsPerMonth: 0,
            aiActionCosts: {
              ...defaultPlanLimits.aiActionCosts,
              timing: 2,
            },
          },
          name: `Portal AI ${randomUUID()}`,
          slug: `portal-ai-${randomUUID()}`,
          updatedByUserId: owner.userId,
        })
        .returning({ id: plans.id });
      if (!plan) throw new Error('AI test plan was not created.');
      await database.insert(workspacePlanAssignments).values({
        planId: plan.id,
        source: 'admin',
        workspaceId: owner.workspaceId,
      });
      await database
        .insert(aiModelRoutes)
        .values({ kind: 'timing', enabled: true })
        .onConflictDoUpdate({
          target: aiModelRoutes.kind,
          set: { enabled: true },
        });
      const queue = {
        add: () => Promise.resolve({ id: 'test-ai-job' }),
      } as unknown as Queue<AiRequestJobData>;
      const events = {
        emit: () => Promise.resolve(),
      } as unknown as AutomationEventsService;
      const service = new AiService(
        { db: database } as DatabaseService,
        new TeamAccountAccessService({ db: database } as DatabaseService),
        events,
        new PlanAccessService({ db: database } as DatabaseService),
        queue,
      );
      const input = {
        idempotencyKey: 'portal-ai-idempotency-test',
        input: {},
        kind: 'timing',
        prompt: 'Create a short integration test caption.',
      };

      const first = await service.createRequest(owner.session, input);
      const second = await service.createRequest(owner.session, input);
      const credits = await service.credits(owner.session);
      const [account] = await database
        .select()
        .from(workspaceCreditAccounts)
        .where(eq(workspaceCreditAccounts.workspaceId, owner.workspaceId));
      const requests = await database
        .select()
        .from(aiRequests)
        .where(eq(aiRequests.workspaceId, owner.workspaceId));
      const ledger = await database
        .select()
        .from(creditLedgerEntries)
        .where(
          and(
            eq(creditLedgerEntries.workspaceId, owner.workspaceId),
            eq(creditLedgerEntries.type, 'debit'),
          ),
        );

      expect(second.id).toBe(first.id);
      expect(account?.balanceUnits).toBe(8);
      expect(credits).toMatchObject({ balanceUnits: 8, usedUnits: 2 });
      expect(requests).toHaveLength(1);
      expect(ledger).toHaveLength(1);
    });
  });
});
