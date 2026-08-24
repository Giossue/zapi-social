import type { PortalAuthSession } from '@workspace/contracts';
import {
  billingSubscriptions,
  createDatabase,
  plans,
  users,
  workspacePlanAssignments,
  workspaces,
  type Database,
} from '@workspace/database';
import { eq } from '@workspace/database/query';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { PortalPlanChangesService } from './portal-plan-changes.service';

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
const rollback = new Error('Rollback portal plan changes integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) throw new Error('Local billing database is unavailable.');
  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

function session(
  userId: string,
  workspaceId: string,
  role: PortalAuthSession['workspace']['role'] = 'owner',
): PortalAuthSession {
  return {
    area: 'portal',
    user: {
      id: userId,
      email: 'plan-owner@example.test',
      displayName: 'Plan owner',
      locale: 'es',
    },
    workspace: {
      id: workspaceId,
      name: 'Plan lifecycle workspace',
      slug: 'plan-lifecycle',
      role,
    },
    workspaces: [],
  };
}

describeDatabase('Portal scheduled plan changes', () => {
  afterAll(async () => connection?.client.end());

  it('schedules a free downgrade at period end and lets the owner undo it', async () => {
    await inRollbackTransaction(async (database) => {
      const userId = randomUUID();
      const workspaceId = randomUUID();
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 86_400_000);
      const externalSubscriptionId = `polar-${randomUUID()}`;
      await database.insert(users).values({
        id: userId,
        email: `plan-change-${userId}@example.test`,
        displayName: 'Plan change owner',
      });
      await database.insert(workspaces).values({
        id: workspaceId,
        ownerUserId: userId,
        name: 'Plan change workspace',
        slug: `plan-change-${workspaceId.slice(0, 8)}`,
      });
      await database.update(plans).set({ isDefaultSignup: false });
      const [freePlan, paidPlan] = await database
        .insert(plans)
        .values([
          {
            name: `Free ${randomUUID()}`,
            slug: `free-${randomUUID()}`,
            isFree: true,
            isDefaultSignup: true,
            createdByUserId: userId,
            updatedByUserId: userId,
          },
          {
            name: `Paid ${randomUUID()}`,
            slug: `paid-${randomUUID()}`,
            price: '29.00',
            createdByUserId: userId,
            updatedByUserId: userId,
          },
        ])
        .returning({ id: plans.id, isFree: plans.isFree });
      if (!freePlan || !paidPlan) throw new Error('Plans were not created.');
      const target = freePlan.isFree ? freePlan : paidPlan;
      const current = freePlan.isFree ? paidPlan : freePlan;
      await database.insert(workspacePlanAssignments).values({
        workspaceId,
        planId: current.id,
        source: 'subscription',
      });
      const [subscription] = await database
        .insert(billingSubscriptions)
        .values({
          externalSubscriptionId,
          workspaceId,
          userId,
          planId: current.id,
          status: 'active',
          amountMinor: 2900,
          interval: 'month',
          currentPeriodStartsAt: now,
          currentPeriodEndsAt: periodEnd,
        })
        .returning({ id: billingSubscriptions.id });
      if (!subscription) throw new Error('Subscription was not created.');
      const update = jest.fn().mockResolvedValue({});
      const service = new PortalPlanChangesService(
        { db: database } as DatabaseService,
        {
          client: jest.fn().mockResolvedValue({ subscriptions: { update } }),
        } as never,
      );
      const owner = session(userId, workspaceId);

      await expect(
        service.schedule(owner, { planId: current.id }),
      ).rejects.toMatchObject({ code: 'BILLING_PLAN_CHANGE_UNAVAILABLE' });
      expect(update).not.toHaveBeenCalled();

      await expect(
        service.schedule(owner, { planId: target.id }),
      ).resolves.toEqual({
        nextPlanId: target.id,
        effectiveAt: periodEnd.toISOString(),
      });
      expect(update).toHaveBeenCalledWith({
        id: externalSubscriptionId,
        subscriptionUpdate: { cancelAtPeriodEnd: true },
      });
      await expect(service.state(owner)).resolves.toEqual({
        nextPlanId: target.id,
        effectiveAt: periodEnd.toISOString(),
      });
      const [scheduled] = await database
        .select()
        .from(workspacePlanAssignments)
        .where(eq(workspacePlanAssignments.workspaceId, workspaceId));
      expect(scheduled?.nextPlanId).toBe(target.id);

      await expect(service.cancel(owner)).resolves.toBeUndefined();
      expect(update).toHaveBeenLastCalledWith({
        id: externalSubscriptionId,
        subscriptionUpdate: { cancelAtPeriodEnd: false },
      });
      const [cancelled] = await database
        .select()
        .from(workspacePlanAssignments)
        .where(eq(workspacePlanAssignments.workspaceId, workspaceId));
      const [localSubscription] = await database
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, subscription.id));
      expect(cancelled?.nextPlanId).toBeNull();
      expect(localSubscription?.cancelAtPeriodEnd).toBe(false);
    });
  });

  it('rejects mutations from a non-owner before accessing billing data', async () => {
    const service = new PortalPlanChangesService(
      {} as DatabaseService,
      {} as never,
    );
    const member = session(randomUUID(), randomUUID(), 'member');

    await expect(
      service.schedule(member, { planId: randomUUID() }),
    ).rejects.toMatchObject({
      code: 'BILLING_OWNER_REQUIRED',
    });
    await expect(service.cancel(member)).rejects.toMatchObject({
      code: 'BILLING_OWNER_REQUIRED',
    });
  });
});
