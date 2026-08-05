import { randomUUID } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  createDatabase,
  rssScheduleHistories,
  rssSchedules,
  rssScheduleTargets,
  socialAccounts,
  users,
  workspaces,
  type Database,
} from '@workspace/database';
import type { PortalAuthSession } from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { RssFeedValidationService } from './rss-feed-validation.service';
import { RssSchedulesService } from './rss-schedules.service';

const databaseUrl = process.env.RSS_SCHEDULES_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();

const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = Symbol('rollback');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

function portalSession(
  userId: string,
  workspace: { id: string; name: string; slug: string },
): PortalAuthSession {
  return {
    area: 'portal',
    user: {
      displayName: 'RSS test user',
      email: 'rss-test@example.test',
      id: userId,
    },
    workspace: { ...workspace, role: 'owner' },
  };
}

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) throw new Error('Local RSS test database is unavailable.');

  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function seedWorkspace(
  database: Database,
  suffix: string,
): Promise<{ userId: string; workspaceId: string }> {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const now = new Date();

  await database.insert(users).values({
    createdAt: now,
    displayName: `RSS test ${suffix}`,
    email: `rss-${suffix}@example.test`,
    id: userId,
    updatedAt: now,
  });
  await database.insert(workspaces).values({
    createdAt: now,
    id: workspaceId,
    name: `RSS workspace ${suffix}`,
    ownerUserId: userId,
    slug: `rss-${suffix}-${workspaceId.slice(0, 8)}`,
    updatedAt: now,
  });

  return { userId, workspaceId };
}

async function seedSchedule(
  database: Database,
  workspaceId: string,
  userId: string,
) {
  const now = new Date();
  const id = randomUUID();
  await database.insert(rssSchedules).values({
    contentRules: {},
    createdAt: now,
    createdByUserId: userId,
    description: '',
    feedUrl: 'https://example.test/rss.xml',
    id,
    name: 'RSS integration test',
    status: 'active',
    timeSlots: ['09:00'],
    timezone: 'America/Guayaquil',
    updatedAt: now,
    weekdays: ['mon'],
    workspaceId,
  });
  return id;
}

describeDatabase('RSS schedules database contracts', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('does not expose a schedule from another workspace through the API service', async () => {
    await inRollbackTransaction(async (database) => {
      const owner = await seedWorkspace(database, 'owner');
      const outsider = await seedWorkspace(database, 'outsider');
      const scheduleId = await seedSchedule(
        database,
        owner.workspaceId,
        owner.userId,
      );
      const service = new RssSchedulesService(
        { db: database } as DatabaseService,
        {} as RssFeedValidationService,
        {} as Queue,
      );

      await expect(
        service.get(
          portalSession(outsider.userId, {
            id: outsider.workspaceId,
            name: 'RSS workspace outsider',
            slug: 'rss-outsider',
          }),
          scheduleId,
        ),
      ).rejects.toMatchObject({
        code: 'REQUEST_FAILED',
      } satisfies Partial<AppException>);

      try {
        await service.get(
          portalSession(outsider.userId, {
            id: outsider.workspaceId,
            name: 'RSS workspace outsider',
            slug: 'rss-outsider',
          }),
          scheduleId,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });
  });

  it('enforces one history row per schedule, destination and content hash', async () => {
    await inRollbackTransaction(async (database) => {
      const workspace = await seedWorkspace(database, 'deduplication');
      const scheduleId = await seedSchedule(
        database,
        workspace.workspaceId,
        workspace.userId,
      );
      const accountId = randomUUID();
      const targetId = randomUUID();
      const now = new Date();
      const history = {
        contentHash: 'a'.repeat(64),
        createdAt: now,
        result: 'queued' as const,
        rssScheduleId: scheduleId,
        rssScheduleTargetId: targetId,
        updatedAt: now,
        workspaceId: workspace.workspaceId,
      };

      await database.insert(socialAccounts).values({
        capabilityKey: 'facebook_page',
        createdAt: now,
        displayName: 'RSS test channel',
        id: accountId,
        providerKey: 'meta',
        updatedAt: now,
        workspaceId: workspace.workspaceId,
      });
      await database.insert(rssScheduleTargets).values({
        createdAt: now,
        id: targetId,
        rssScheduleId: scheduleId,
        socialAccountId: accountId,
        updatedAt: now,
        workspaceId: workspace.workspaceId,
      });
      await database.insert(rssScheduleHistories).values(history);

      await expect(
        Promise.resolve(database.insert(rssScheduleHistories).values(history)),
      ).rejects.toMatchObject({ cause: { code: '23505' } });
    });
  });
});
