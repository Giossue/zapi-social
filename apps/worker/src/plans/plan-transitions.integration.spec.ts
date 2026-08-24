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
import type { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { PLAN_TRANSITIONS_JOB } from './plan-transitions.constants';
import { PlanTransitionsProcessor } from './plan-transitions.processor';

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
const rollback = new Error('Rollback plan transitions integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) throw new Error('Local Worker database is unavailable.');
  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

describeDatabase('Scheduled plan transition Worker', () => {
  afterAll(async () => connection?.client.end());

  it('activates the selected plan once the paid period ends', async () => {
    await inRollbackTransaction(async (database) => {
      const userId = randomUUID();
      const workspaceId = randomUUID();
      await database.insert(users).values({
        id: userId,
        email: `worker-plan-${userId}@example.test`,
        displayName: 'Worker plan owner',
      });
      await database.insert(workspaces).values({
        id: workspaceId,
        ownerUserId: userId,
        name: 'Worker plan workspace',
        slug: `worker-plan-${workspaceId.slice(0, 8)}`,
      });
      await database.update(plans).set({ isDefaultSignup: false });
      const [targetPlan, currentPlan] = await database
        .insert(plans)
        .values([
          {
            name: `Worker free ${randomUUID()}`,
            slug: `worker-free-${randomUUID()}`,
            isFree: true,
            isDefaultSignup: true,
            createdByUserId: userId,
            updatedByUserId: userId,
          },
          {
            name: `Worker paid ${randomUUID()}`,
            slug: `worker-paid-${randomUUID()}`,
            price: '29.00',
            createdByUserId: userId,
            updatedByUserId: userId,
          },
        ])
        .returning({ id: plans.id, isFree: plans.isFree });
      if (!targetPlan || !currentPlan) {
        throw new Error('Worker plans were not created.');
      }
      const target = targetPlan.isFree ? targetPlan : currentPlan;
      const current = targetPlan.isFree ? currentPlan : targetPlan;
      await database.insert(workspacePlanAssignments).values({
        workspaceId,
        planId: current.id,
        nextPlanId: target.id,
        source: 'subscription',
      });
      await database.insert(billingSubscriptions).values({
        externalSubscriptionId: `worker-polar-${randomUUID()}`,
        workspaceId,
        userId,
        planId: current.id,
        status: 'canceled',
        amountMinor: 2900,
        interval: 'month',
        currentPeriodStartsAt: new Date(Date.now() - 86_400_000),
        currentPeriodEndsAt: new Date(Date.now() - 1_000),
        endedAt: new Date(),
      });
      const processor = new PlanTransitionsProcessor({
        db: database,
      } as DatabaseService);
      const job = { name: PLAN_TRANSITIONS_JOB } as Job;

      await processor.process(job);
      await processor.process(job);

      const [assignment] = await database
        .select()
        .from(workspacePlanAssignments)
        .where(eq(workspacePlanAssignments.workspaceId, workspaceId));
      expect(assignment).toMatchObject({
        planId: target.id,
        nextPlanId: null,
        source: 'admin',
      });
    });
  });
});
