import { randomUUID } from 'node:crypto';
import {
  createDatabase,
  plans,
  users,
  workspacePlanAssignments,
  workspaces,
  type Database,
} from '@workspace/database';
import { eq } from '@workspace/database/query';
import { defaultPlanLimits } from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { PlanAccessService } from './plan-access.service';

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
const rollback = new Error('Rollback Plan access integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection)
    throw new Error('Local Plan access database is unavailable.');
  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

describeDatabase('Plan access lifecycle', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('resolves assignments, workspace overrides and restrictive fallbacks', async () => {
    await inRollbackTransaction(async (database) => {
      const userId = randomUUID();
      const workspaceId = randomUUID();
      const now = new Date();
      await database.insert(users).values({
        createdAt: now,
        displayName: 'Plan access owner',
        email: `plan-access-${userId}@example.test`,
        id: userId,
        updatedAt: now,
      });
      await database.insert(workspaces).values({
        createdAt: now,
        id: workspaceId,
        name: 'Plan access workspace',
        ownerUserId: userId,
        slug: `plan-access-${workspaceId.slice(0, 8)}`,
        updatedAt: now,
      });
      await database.update(plans).set({ isDefaultSignup: false });
      const [fallbackPlan, assignedPlan] = await database
        .insert(plans)
        .values([
          {
            createdByUserId: userId,
            isDefaultSignup: true,
            isFree: true,
            limits: {
              ...defaultPlanLimits,
              creditsPerMonth: 3,
              enabledModules: ['publishing'],
            },
            name: `Fallback ${randomUUID()}`,
            slug: `fallback-${randomUUID()}`,
            updatedByUserId: userId,
          },
          {
            createdByUserId: userId,
            limits: {
              ...defaultPlanLimits,
              creditsPerMonth: 20,
              enabledModules: ['publishing', 'automation'],
            },
            name: `Assigned ${randomUUID()}`,
            slug: `assigned-${randomUUID()}`,
            updatedByUserId: userId,
          },
        ])
        .returning({ id: plans.id, isDefaultSignup: plans.isDefaultSignup });
      if (!fallbackPlan || !assignedPlan) {
        throw new Error('Plan access fixtures were not created.');
      }
      const fallback = fallbackPlan.isDefaultSignup
        ? fallbackPlan
        : assignedPlan;
      const assigned = fallbackPlan.isDefaultSignup
        ? assignedPlan
        : fallbackPlan;
      await database.insert(workspacePlanAssignments).values({
        planId: assigned.id,
        source: 'admin',
        workspaceId,
      });
      const service = new PlanAccessService({
        db: database,
      } as DatabaseService);

      await expect(service.limitsFor(workspaceId)).resolves.toMatchObject({
        creditsPerMonth: 20,
      });
      await expect(service.modulesFor(workspaceId)).resolves.toEqual([
        'publishing',
        'automation',
      ]);

      await database
        .update(workspaces)
        .set({ enabledModules: ['automation', 'files'] })
        .where(eq(workspaces.id, workspaceId));
      await expect(service.modulesFor(workspaceId)).resolves.toEqual([
        'automation',
      ]);

      await database
        .update(workspacePlanAssignments)
        .set({ source: 'subscription' })
        .where(eq(workspacePlanAssignments.workspaceId, workspaceId));
      await expect(service.limitsFor(workspaceId)).resolves.toMatchObject({
        creditsPerMonth: 3,
      });
      await expect(service.modulesFor(workspaceId)).resolves.toEqual([]);

      await database
        .update(plans)
        .set({ isDefaultSignup: false })
        .where(eq(plans.id, fallback.id));
      await expect(service.limitsFor(workspaceId)).resolves.toMatchObject({
        creditsPerMonth: 0,
        enabledModules: [],
      });

      await database
        .update(workspacePlanAssignments)
        .set({ source: 'admin' })
        .where(eq(workspacePlanAssignments.workspaceId, workspaceId));
      await database
        .update(plans)
        .set({ limits: { unexpected: true } })
        .where(eq(plans.id, assigned.id));
      await expect(service.limitsFor(workspaceId)).resolves.toMatchObject({
        creditsPerMonth: 0,
        enabledModules: [],
      });
    });
  });
});
