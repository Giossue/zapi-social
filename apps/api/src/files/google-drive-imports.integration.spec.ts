import { randomBytes, randomUUID } from 'node:crypto';
import {
  createDatabase,
  fileImportBatches,
  fileImportItems,
  users,
  workspaces,
} from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import type { PortalAuthSession } from '@workspace/contracts';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { AppException } from '../platform/errors/app-exception';
import { GoogleDriveImportsService } from './google-drive-imports.service';

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

function session(
  userId: string,
  workspaceId: string,
  role: 'owner' | 'admin' | 'member' = 'owner',
): PortalAuthSession {
  const workspace = {
    id: workspaceId,
    name: 'Drive test workspace',
    slug: `drive-${workspaceId.slice(0, 8)}`,
  };
  return {
    area: 'portal',
    user: {
      id: userId,
      email: `drive-${userId}@example.test`,
      displayName: 'Drive test user',
    },
    workspace: { ...workspace, role },
    workspaces: [{ ...workspace, role }],
  };
}

async function seedWorkspace() {
  if (!connection) throw new Error('Local test database unavailable.');
  const userId = randomUUID();
  const workspaceId = randomUUID();
  await connection.db.insert(users).values({
    id: userId,
    email: `drive-${userId}@example.test`,
    displayName: 'Drive test user',
  });
  await connection.db.insert(workspaces).values({
    id: workspaceId,
    ownerUserId: userId,
    name: 'Drive test workspace',
    slug: `drive-${workspaceId.slice(0, 8)}`,
  });
  return { userId, workspaceId };
}

describeDatabase('Google Drive import contracts', () => {
  const queued: unknown[] = [];
  const integration = {
    readGoogleDrivePortalConfiguration: () =>
      Promise.resolve({
        enabled: true,
        oauthClientId: 'client.apps.googleusercontent.com',
        browserApiKey: 'browser-key',
        appId: '123456789012',
      }),
  } as IntegrationsService;
  const queue = {
    add: (_name: string, data: unknown) => {
      queued.push(data);
      return Promise.resolve(undefined);
    },
  } as unknown as Queue;
  const config = new ConfigService({
    PROVIDER_INTEGRATIONS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  });

  afterAll(async () => connection?.client.end());

  it('persists one encrypted idempotent batch and scopes reads by workspace', async () => {
    if (!connection) throw new Error('Local test database unavailable.');
    const owner = await seedWorkspace();
    const outsider = await seedWorkspace();
    const service = new GoogleDriveImportsService(
      { db: connection.db } as DatabaseService,
      integration,
      config,
      queue,
    );
    const idempotencyKey = `drive-test-${randomUUID()}`;
    const input = {
      accessToken: 'temporary-access-token',
      credentialExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      destinationFolderId: null,
      idempotencyKey,
      sourceContext: 'publishing' as const,
      files: [
        { providerFileId: 'provider-file-id', resourceKey: 'resource-key' },
      ],
    };

    try {
      const first = await service.createBatch(
        Promise.resolve(session(owner.userId, owner.workspaceId)),
        input,
      );
      const repeated = await service.createBatch(
        Promise.resolve(session(owner.userId, owner.workspaceId)),
        input,
      );
      expect(repeated.id).toBe(first.id);
      expect(queued).toContainEqual({ batchId: first.id });

      const [storedBatch] = await connection.db
        .select()
        .from(fileImportBatches)
        .where(eq(fileImportBatches.id, first.id));
      const [storedItem] = await connection.db
        .select()
        .from(fileImportItems)
        .where(eq(fileImportItems.batchId, first.id));
      expect(storedBatch?.encryptedAccessToken).toBeTruthy();
      expect(storedBatch?.encryptedAccessToken).not.toContain(
        input.accessToken,
      );
      expect(storedItem?.providerFileIdCiphertext).toBeTruthy();
      expect(storedItem?.providerFileIdCiphertext).not.toContain(
        input.files[0].providerFileId,
      );

      await expect(
        service.getBatch(
          Promise.resolve(session(outsider.userId, outsider.workspaceId)),
          first.id,
        ),
      ).rejects.toMatchObject({
        code: 'REQUEST_FAILED',
      } satisfies Partial<AppException>);
      await expect(
        service.createBatch(
          Promise.resolve(session(owner.userId, owner.workspaceId, 'member')),
          { ...input, idempotencyKey: `${idempotencyKey}-member` },
        ),
      ).rejects.toMatchObject({
        code: 'AUTH_PORTAL_ACCESS_REQUIRED',
      } satisfies Partial<AppException>);
    } finally {
      await connection.db
        .delete(workspaces)
        .where(
          and(
            eq(workspaces.id, owner.workspaceId),
            eq(workspaces.ownerUserId, owner.userId),
          ),
        );
      await connection.db
        .delete(workspaces)
        .where(eq(workspaces.id, outsider.workspaceId));
      await connection.db.delete(users).where(eq(users.id, owner.userId));
      await connection.db.delete(users).where(eq(users.id, outsider.userId));
    }
  });

  it('requires the current Picker configuration to be tested before enabling it', async () => {
    if (!connection) throw new Error('Local test database unavailable.');
    const rollback = new Error('Rollback Google Drive integration test.');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(
        Response.json({
          id: 'selected-drive-file',
          mimeType: 'image/png',
        }),
      );
    try {
      await connection.db.transaction(async (transaction) => {
        const adminId = randomUUID();
        await transaction.insert(users).values({
          id: adminId,
          email: `drive-admin-${adminId}@example.test`,
          displayName: 'Drive Admin test',
          isPlatformAdmin: true,
        });
        const service = new IntegrationsService(
          new ConfigService({
            PROVIDER_INTEGRATIONS_ENCRYPTION_KEY: config.getOrThrow<string>(
              'PROVIDER_INTEGRATIONS_ENCRYPTION_KEY',
            ),
          }),
          { db: transaction } as unknown as DatabaseService,
        );
        const adminSession = {
          area: 'admin' as const,
          user: {
            id: adminId,
            email: `drive-admin-${adminId}@example.test`,
            displayName: 'Drive Admin test',
          },
        };
        const driveConfiguration = {
          oauthClientId: 'client.apps.googleusercontent.com',
          browserApiKey: 'browser-api-key',
          appId: '123456789012',
        };

        await expect(
          service.saveGoogleDrive(
            { enabled: true, configuration: driveConfiguration },
            adminSession,
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
        await service.testGoogleDrive(
          {
            configuration: driveConfiguration,
            accessToken: 'temporary-token',
            selection: { providerFileId: 'selected-drive-file' },
          },
          adminSession,
        );
        const saved = await service.saveGoogleDrive(
          { enabled: true, configuration: driveConfiguration },
          adminSession,
        );
        expect(saved).toMatchObject({
          enabled: true,
          readiness: 'ready',
          oauthClientId: driveConfiguration.oauthClientId,
          appId: driveConfiguration.appId,
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
