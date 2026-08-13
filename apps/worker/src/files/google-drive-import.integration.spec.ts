import { ConfigService } from '@nestjs/config';
import {
  createDatabase,
  fileAssets,
  fileImportBatches,
  fileImportItems,
  users,
  workspaces,
} from '@workspace/database';
import { eq } from '@workspace/database/query';
import type { Queue, Job } from 'bullmq';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkerAuditService } from '../audit/worker-audit.service';
import { DatabaseService } from '../database/database.service';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import {
  FILE_IMPORTS_QUEUE,
  GOOGLE_DRIVE_IMPORT_JOB,
  type FileImportJobData,
} from './file-imports.constants';
import { GoogleDriveImportProcessor } from './google-drive-import.processor';

const databaseUrl =
  process.env.GOOGLE_DRIVE_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();
const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

describeDatabase('Google Drive import Worker', () => {
  afterAll(async () => connection?.client.end());

  it('streams, validates and finalizes a selected image as a Files asset', async () => {
    if (!connection) throw new Error('Local test database unavailable.');
    const root = await mkdtemp(join(tmpdir(), 'zapi-drive-import-'));
    const userId = randomUUID();
    const workspaceId = randomUUID();
    const batchId = randomUUID();
    const itemId = randomUUID();
    const providerFileId = 'drive-image-id';
    const providerFileIdHash = createHash('sha256')
      .update(providerFileId)
      .digest('hex');
    const key = randomBytes(32).toString('base64');
    const config = new ConfigService({
      FILES_STORAGE_PATH: root,
      PROVIDER_INTEGRATIONS_ENCRYPTION_KEY: key,
    });
    const encryption = new Aes256GcmService(config);
    const thumbnailJobs: unknown[] = [];
    const queue = {
      add: (_name: string, data: unknown) => {
        thumbnailJobs.push(data);
        return Promise.resolve(undefined);
      },
    } as unknown as Queue;
    const audit = {
      write: () => Promise.resolve(undefined),
    } as unknown as WorkerAuditService;
    const originalFetch = globalThis.fetch;
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    globalThis.fetch = (input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      if (url.searchParams.get('alt') === 'media') {
        return Promise.resolve(new Response(png));
      }
      return Promise.resolve(
        Response.json({
          id: providerFileId,
          name: 'drive-image.png',
          mimeType: 'image/png',
          size: String(png.byteLength),
        }),
      );
    };

    try {
      await connection.db.insert(users).values({
        id: userId,
        email: `drive-worker-${userId}@example.test`,
        displayName: 'Drive Worker test',
      });
      await connection.db.insert(workspaces).values({
        id: workspaceId,
        ownerUserId: userId,
        name: 'Drive Worker workspace',
        slug: `drive-worker-${workspaceId.slice(0, 8)}`,
      });
      await connection.db.insert(fileImportBatches).values({
        id: batchId,
        workspaceId,
        requestedByUserId: userId,
        providerKey: 'google-drive',
        sourceContext: 'publishing',
        encryptedAccessToken: encryption.encrypt(
          'temporary-token',
          `google-drive-import:${batchId}`,
        ),
        credentialExpiresAt: new Date(Date.now() + 3_600_000),
        idempotencyKey: `worker-${randomUUID()}`,
        totalItems: 1,
      });
      await connection.db.insert(fileImportItems).values({
        id: itemId,
        batchId,
        workspaceId,
        providerFileIdHash,
        providerFileIdCiphertext: encryption.encrypt(
          providerFileId,
          `google-drive-file:${batchId}:${providerFileIdHash}`,
        ),
      });
      const processor = new GoogleDriveImportProcessor(
        { db: connection.db } as DatabaseService,
        encryption,
        audit,
        queue,
        config,
      );
      await processor.process({
        name: GOOGLE_DRIVE_IMPORT_JOB,
        data: { batchId },
        id: `google-drive-import-${batchId}`,
        attemptsMade: 0,
        queueName: FILE_IMPORTS_QUEUE,
      } as Job<FileImportJobData>);

      const [batch] = await connection.db
        .select()
        .from(fileImportBatches)
        .where(eq(fileImportBatches.id, batchId));
      const [item] = await connection.db
        .select()
        .from(fileImportItems)
        .where(eq(fileImportItems.id, itemId));
      if (!item?.fileAssetId)
        throw new Error('Import did not create an asset.');
      const [asset] = await connection.db
        .select()
        .from(fileAssets)
        .where(eq(fileAssets.id, item.fileAssetId));
      if (!asset) throw new Error('Imported asset was not found.');
      expect(batch).toMatchObject({
        status: 'completed',
        completedItems: 1,
        failedItems: 0,
        encryptedAccessToken: null,
      });
      expect(item).toMatchObject({
        status: 'completed',
        providerFileIdCiphertext: null,
        resourceKeyCiphertext: null,
      });
      expect(asset).toMatchObject({
        workspaceId,
        status: 'ready',
        mimeType: 'image/png',
        name: 'drive-image.png',
        metadata: { source: 'google_drive', importBatchId: batchId },
      });
      expect(await readFile(join(root, asset.storageKey))).toEqual(
        Buffer.from(png),
      );
      expect(thumbnailJobs).toContainEqual({ assetId: asset.id });
    } finally {
      globalThis.fetch = originalFetch;
      await connection.db
        .delete(workspaces)
        .where(eq(workspaces.id, workspaceId));
      await connection.db.delete(users).where(eq(users.id, userId));
      await rm(root, { recursive: true, force: true });
    }
  });
});
