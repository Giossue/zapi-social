import { randomUUID } from 'node:crypto';
import { access, chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import {
  createDatabase,
  fileAssets,
  fileFolders,
  publishingPostMedia,
  publishingPosts,
  socialAccounts,
  users,
  workspaces,
  type Database,
} from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import type { PortalAuthSession } from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AutomationEventsService } from '../automation/automation-events.service';
import type { PlanAccessService } from '../plans/plan-access.service';
import { AppException } from '../platform/errors/app-exception';
import type { PublishingDeliveryJobData } from '../publishing/publishing.constants';
import { PublishingService } from '../publishing/publishing.service';
import { TeamAccountAccessService } from '../teams/team-account-access.service';
import { FilesService } from './files.service';

const databaseUrl = process.env.FILES_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();

const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback Files lifecycle integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

type PublishingStatus =
  'draft' | 'scheduled' | 'processing' | 'published' | 'failed';

function portalSession(
  userId: string,
  workspace: { id: string; name: string; slug: string },
): PortalAuthSession {
  return {
    area: 'portal',
    user: {
      displayName: 'Files lifecycle owner',
      email: `files-${userId}@example.test`,
      id: userId,
      locale: null,
    },
    workspace: { ...workspace, role: 'owner' },
    workspaces: [{ ...workspace, role: 'owner' }],
  };
}

function filesService(database: Database, storageRoot: string) {
  return new FilesService(
    { db: database } as DatabaseService,
    {
      requireFileSize: () => Promise.resolve(),
    } as unknown as PlanAccessService,
    new ConfigService({ FILES_STORAGE_PATH: storageRoot }),
    {} as Queue,
  );
}

function publishingService(database: Database, storageRoot: string) {
  const databaseService = { db: database } as DatabaseService;
  return new PublishingService(
    databaseService,
    new TeamAccountAccessService(databaseService),
    new AutomationEventsService(databaseService),
    {
      requirePostSlot: () => Promise.resolve(),
    } as unknown as PlanAccessService,
    {
      add: () => Promise.resolve(),
    } as unknown as Queue<PublishingDeliveryJobData>,
    new ConfigService({
      FILES_STORAGE_PATH: storageRoot,
      PROVIDER_INTEGRATIONS_ENCRYPTION_KEY: 'files-lifecycle-test-key',
    }),
  );
}

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) throw new Error('Local Files test database is unavailable.');
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
  const accountId = randomUUID();
  const now = new Date();
  const workspace = {
    id: workspaceId,
    name: `Files lifecycle ${suffix}`,
    slug: `files-lifecycle-${suffix}-${workspaceId.slice(0, 8)}`,
  };
  await database.insert(users).values({
    createdAt: now,
    displayName: `Files lifecycle ${suffix}`,
    email: `files-lifecycle-${suffix}-${userId}@example.test`,
    id: userId,
    updatedAt: now,
  });
  await database.insert(workspaces).values({
    ...workspace,
    createdAt: now,
    ownerUserId: userId,
    updatedAt: now,
  });
  await database.insert(socialAccounts).values({
    capabilityKey: 'instagram_profile',
    displayName: `Files lifecycle ${suffix}`,
    id: accountId,
    providerKey: 'meta',
    workspaceId,
  });
  return {
    accountId,
    session: portalSession(userId, workspace),
    userId,
    workspaceId,
  };
}

async function seedAsset(
  database: Database,
  storageRoot: string,
  scenario: Awaited<ReturnType<typeof seedWorkspace>>,
  suffix: string,
  folderId?: string,
) {
  const assetId = randomUUID();
  const storageKey = `${scenario.workspaceId}/${assetId}.png`;
  const path = join(storageRoot, storageKey);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, 'test-image');
  await database.insert(fileAssets).values({
    createdByUserId: scenario.userId,
    folderId: folderId ?? null,
    id: assetId,
    mimeType: 'image/png',
    name: `${suffix}.png`,
    sizeBytes: 10,
    status: 'ready',
    storageKey,
    workspaceId: scenario.workspaceId,
  });
  return { assetId, path };
}

async function referenceAsset(
  database: Database,
  scenario: Awaited<ReturnType<typeof seedWorkspace>>,
  assetId: string,
  status: PublishingStatus,
) {
  const [post] = await database
    .insert(publishingPosts)
    .values({
      authorUserId: scenario.userId,
      content: `${status} post`,
      socialAccountId: scenario.accountId,
      status,
      workspaceId: scenario.workspaceId,
    })
    .returning({ id: publishingPosts.id });
  if (!post) throw new Error('Unable to seed Publishing post.');
  await database.insert(publishingPostMedia).values({
    fileAssetId: assetId,
    publishingPostId: post.id,
    workspaceId: scenario.workspaceId,
  });
  return post.id;
}

describeDatabase('Files and Publishing lifecycle', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it.each(['draft', 'scheduled', 'processing', 'failed'] as const)(
    'blocks deletion while a %s post may still need the binary',
    async (status) => {
      const storageRoot = await mkdtemp(join(tmpdir(), 'zapi-files-test-'));
      try {
        await inRollbackTransaction(async (database) => {
          const scenario = await seedWorkspace(database, status);
          const asset = await seedAsset(
            database,
            storageRoot,
            scenario,
            status,
          );
          await referenceAsset(database, scenario, asset.assetId, status);

          await expect(
            filesService(database, storageRoot).remove(
              Promise.resolve(scenario.session),
              asset.assetId,
            ),
          ).rejects.toMatchObject({
            code: 'FILE_IN_USE_BY_PUBLISHING',
          } satisfies Partial<AppException>);

          const [stored] = await database
            .select({ status: fileAssets.status })
            .from(fileAssets)
            .where(eq(fileAssets.id, asset.assetId));
          expect(stored?.status).toBe('ready');
          await expect(access(asset.path)).resolves.toBeNull();
        });
      } finally {
        await rm(storageRoot, { force: true, recursive: true });
      }
    },
  );

  it('keeps published history while removing the asset from Files', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'zapi-files-test-'));
    try {
      await inRollbackTransaction(async (database) => {
        const scenario = await seedWorkspace(database, 'published');
        const asset = await seedAsset(
          database,
          storageRoot,
          scenario,
          'published',
        );
        const postId = await referenceAsset(
          database,
          scenario,
          asset.assetId,
          'published',
        );

        await filesService(database, storageRoot).remove(
          Promise.resolve(scenario.session),
          asset.assetId,
        );

        const [stored] = await database
          .select({
            status: fileAssets.status,
            trashedAt: fileAssets.trashedAt,
          })
          .from(fileAssets)
          .where(eq(fileAssets.id, asset.assetId));
        const [reference] = await database
          .select({ id: publishingPostMedia.id })
          .from(publishingPostMedia)
          .where(
            and(
              eq(publishingPostMedia.publishingPostId, postId),
              eq(publishingPostMedia.fileAssetId, asset.assetId),
            ),
          );
        expect(stored?.status).toBe('trashed');
        expect(stored?.trashedAt).toBeInstanceOf(Date);
        expect(reference).toBeDefined();
        await expect(access(asset.path)).rejects.toMatchObject({
          code: 'ENOENT',
        });
      });
    } finally {
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  it('removes an unreferenced asset after committing its tombstone', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'zapi-files-test-'));
    try {
      await inRollbackTransaction(async (database) => {
        const scenario = await seedWorkspace(database, 'unreferenced');
        const asset = await seedAsset(
          database,
          storageRoot,
          scenario,
          'unreferenced',
        );

        await filesService(database, storageRoot).remove(
          Promise.resolve(scenario.session),
          asset.assetId,
        );

        const [stored] = await database
          .select({ status: fileAssets.status })
          .from(fileAssets)
          .where(eq(fileAssets.id, asset.assetId));
        expect(stored?.status).toBe('trashed');
        await expect(access(asset.path)).rejects.toMatchObject({
          code: 'ENOENT',
        });
      });
    } finally {
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  it('keeps the logical deletion coherent when physical cleanup fails', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'zapi-files-test-'));
    let workspaceDirectory: string | null = null;
    try {
      await inRollbackTransaction(async (database) => {
        const scenario = await seedWorkspace(database, 'cleanup-failure');
        const asset = await seedAsset(
          database,
          storageRoot,
          scenario,
          'cleanup-failure',
        );
        workspaceDirectory = join(storageRoot, scenario.workspaceId);
        await chmod(workspaceDirectory, 0o555);

        await filesService(database, storageRoot).remove(
          Promise.resolve(scenario.session),
          asset.assetId,
        );

        const [stored] = await database
          .select({ status: fileAssets.status })
          .from(fileAssets)
          .where(eq(fileAssets.id, asset.assetId));
        expect(stored?.status).toBe('trashed');
        await expect(access(asset.path)).resolves.toBeNull();
      });
    } finally {
      if (workspaceDirectory) await chmod(workspaceDirectory, 0o755);
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  it('does not partially delete a folder with a scheduled descendant', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'zapi-files-test-'));
    try {
      await inRollbackTransaction(async (database) => {
        const scenario = await seedWorkspace(database, 'folder');
        const [folder] = await database
          .insert(fileFolders)
          .values({
            createdByUserId: scenario.userId,
            name: 'Scheduled assets',
            workspaceId: scenario.workspaceId,
          })
          .returning({ id: fileFolders.id });
        if (!folder) throw new Error('Unable to seed folder.');
        const free = await seedAsset(
          database,
          storageRoot,
          scenario,
          'free',
          folder.id,
        );
        const blocked = await seedAsset(
          database,
          storageRoot,
          scenario,
          'blocked',
          folder.id,
        );
        await referenceAsset(database, scenario, blocked.assetId, 'scheduled');

        await expect(
          filesService(database, storageRoot).removeFolder(
            Promise.resolve(scenario.session),
            folder.id,
          ),
        ).rejects.toMatchObject({
          code: 'FILE_IN_USE_BY_PUBLISHING',
        } satisfies Partial<AppException>);

        const [storedFolder] = await database
          .select({ status: fileFolders.status })
          .from(fileFolders)
          .where(eq(fileFolders.id, folder.id));
        const storedAssets = await database
          .select({ status: fileAssets.status })
          .from(fileAssets)
          .where(eq(fileAssets.folderId, folder.id));
        expect(storedFolder?.status).toBe('active');
        expect(storedAssets.map(({ status }) => status)).toEqual([
          'ready',
          'ready',
        ]);
        await expect(access(free.path)).resolves.toBeNull();
        await expect(access(blocked.path)).resolves.toBeNull();
      });
    } finally {
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  it('serializes scheduling and deletion of the same asset', async () => {
    if (!connection)
      throw new Error('Local Files test database is unavailable.');
    const storageRoot = await mkdtemp(join(tmpdir(), 'zapi-files-test-'));
    const scenario = await seedWorkspace(connection.db, 'race');
    try {
      const asset = await seedAsset(
        connection.db,
        storageRoot,
        scenario,
        'race',
      );
      const [deletion, scheduling] = await Promise.allSettled([
        filesService(connection.db, storageRoot).remove(
          Promise.resolve(scenario.session),
          asset.assetId,
        ),
        publishingService(connection.db, storageRoot).create(scenario.session, {
          accountIds: [scenario.accountId],
          content: 'Concurrent scheduled post',
          idempotencyKey: `files-race-${randomUUID()}`,
          mediaAssetIds: [asset.assetId],
          mode: 'schedule',
          scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      ]);
      expect(
        [deletion, scheduling].filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);

      const [stored] = await connection.db
        .select({ status: fileAssets.status })
        .from(fileAssets)
        .where(eq(fileAssets.id, asset.assetId));
      const activeReferences = await connection.db
        .select({ id: publishingPostMedia.id })
        .from(publishingPostMedia)
        .innerJoin(
          publishingPosts,
          eq(publishingPostMedia.publishingPostId, publishingPosts.id),
        )
        .where(
          and(
            eq(publishingPostMedia.fileAssetId, asset.assetId),
            eq(publishingPosts.status, 'scheduled'),
          ),
        );
      expect(stored?.status === 'trashed' && activeReferences.length > 0).toBe(
        false,
      );
    } finally {
      await connection.db
        .delete(workspaces)
        .where(eq(workspaces.id, scenario.workspaceId));
      await connection.db.delete(users).where(eq(users.id, scenario.userId));
      await rm(storageRoot, { force: true, recursive: true });
    }
  });
});
