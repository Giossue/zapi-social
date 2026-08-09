import { randomUUID } from 'node:crypto';
import {
  createDatabase,
  fileAssets,
  publishingWatermarks,
  supportCategories,
  users,
  workspaces,
  type Database,
} from '@workspace/database';
import type { PortalAuthSession } from '@workspace/contracts';
import { DatabaseService } from './database/database.service';
import { AppException } from './platform/errors/app-exception';
import { SupportService } from './support/support.service';
import { WatermarksService } from './watermarks/watermarks.service';

const databaseUrl = process.env.SUPPORT_WATERMARKS_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();

const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback Support and Watermarks integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

function portalSession(
  userId: string,
  workspace: { id: string; name: string; slug: string },
): PortalAuthSession {
  return {
    area: 'portal',
    user: {
      displayName: 'Support test user',
      email: 'support-test@example.test',
      id: userId,
    },
    workspace: { ...workspace, role: 'owner' },
    workspaces: [{ ...workspace, role: 'owner' }],
  };
}

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection)
    throw new Error('Local Support test database is unavailable.');
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
    displayName: `Support test ${suffix}`,
    email: `support-${suffix}-${userId}@example.test`,
    id: userId,
    updatedAt: now,
  });
  await database.insert(workspaces).values({
    createdAt: now,
    id: workspaceId,
    name: `Support workspace ${suffix}`,
    ownerUserId: userId,
    slug: `support-${suffix}-${workspaceId.slice(0, 8)}`,
    updatedAt: now,
  });
  return { userId, workspaceId };
}

describeDatabase('Support and Watermarks database contracts', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('does not expose a requester ticket or watermark to another workspace', async () => {
    await inRollbackTransaction(async (database) => {
      const owner = await seedWorkspace(database, 'owner');
      const outsider = await seedWorkspace(database, 'outsider');
      const categoryId = randomUUID();
      const now = new Date();
      await database.insert(supportCategories).values({
        createdAt: now,
        id: categoryId,
        name: 'Test category',
        slug: `test-category-${categoryId}`,
        updatedAt: now,
      });
      const support = new SupportService({ db: database } as DatabaseService);
      const watermarks = new WatermarksService({
        db: database,
      } as DatabaseService);
      const ownerSession = portalSession(owner.userId, {
        id: owner.workspaceId,
        name: 'Support workspace owner',
        slug: 'support-owner',
      });
      const outsiderSession = portalSession(outsider.userId, {
        id: outsider.workspaceId,
        name: 'Support workspace outsider',
        slug: 'support-outsider',
      });
      const ticket = await support.create(ownerSession, {
        categoryId,
        description: 'The support test needs a durable private ticket.',
        subject: 'Private ticket',
      });
      const watermark = await watermarks.create(ownerSession, {
        text: '@zapi',
        type: 'text',
      });

      await expect(
        support.get(outsiderSession, ticket.id),
      ).rejects.toMatchObject({
        code: 'SUPPORT_TICKET_NOT_FOUND',
      } satisfies Partial<AppException>);
      await expect(
        watermarks.get(outsiderSession, watermark.id),
      ).rejects.toMatchObject({
        code: 'WATERMARK_NOT_FOUND',
      } satisfies Partial<AppException>);
    });
  });

  it('enforces one watermark target and keeps image assets in their workspace', async () => {
    await inRollbackTransaction(async (database) => {
      const workspace = await seedWorkspace(database, 'watermark');
      const otherWorkspace = await seedWorkspace(database, 'other-file');
      const now = new Date();
      const assetId = randomUUID();
      await database.insert(fileAssets).values({
        createdAt: now,
        createdByUserId: otherWorkspace.userId,
        id: assetId,
        mimeType: 'image/png',
        name: 'other-workspace.png',
        sizeBytes: 1,
        status: 'ready',
        storageKey: `${otherWorkspace.workspaceId}/${assetId}`,
        updatedAt: now,
        workspaceId: otherWorkspace.workspaceId,
      });
      const session = portalSession(workspace.userId, {
        id: workspace.workspaceId,
        name: 'Support workspace watermark',
        slug: 'support-watermark',
      });
      const service = new WatermarksService({
        db: database,
      } as DatabaseService);

      await expect(
        service.create(session, { imageFileAssetId: assetId, type: 'image' }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      } satisfies Partial<AppException>);

      await service.create(session, { text: '@zapi', type: 'text' });
      await expect(
        service.create(session, { text: '@zapi-second', type: 'text' }),
      ).rejects.toMatchObject({
        code: 'WATERMARK_TARGET_EXISTS',
      } satisfies Partial<AppException>);

      await expect(
        Promise.resolve(
          database.insert(publishingWatermarks).values({
            createdByUserId: workspace.userId,
            text: '@zapi-third',
            type: 'text',
            workspaceId: workspace.workspaceId,
          }),
        ),
      ).rejects.toMatchObject({ cause: { code: '23505' } });
    });
  });
});
