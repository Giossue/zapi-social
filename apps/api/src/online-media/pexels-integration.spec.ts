import { randomBytes, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  createDatabase,
  providerIntegrations,
  users,
} from '@workspace/database';
import { eq } from '@workspace/database/query';
import type { AuthSession } from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { IntegrationsService } from '../integrations/integrations.service';

const databaseUrl =
  process.env.ONLINE_MEDIA_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
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

describeDatabase('Pexels Admin integration', () => {
  afterAll(async () => connection?.client.end());

  it('tests, encrypts and gates the provider before Portal can use it', async () => {
    if (!connection) throw new Error('Local test database unavailable.');
    const rollback = new Error('Rollback Pexels integration test.');
    const originalFetch = globalThis.fetch;
    const apiKey = `pexels-test-${randomUUID()}`;
    globalThis.fetch = (_input, init) => {
      expect(init?.headers).toEqual({ authorization: apiKey });
      return Promise.resolve(Response.json({ photos: [] }));
    };

    try {
      await connection.db.transaction(async (transaction) => {
        const adminId = randomUUID();
        await transaction.insert(users).values({
          id: adminId,
          email: `pexels-admin-${adminId}@example.test`,
          displayName: 'Pexels Admin test',
          isPlatformAdmin: true,
        });
        const service = new IntegrationsService(
          new ConfigService({
            PROVIDER_INTEGRATIONS_ENCRYPTION_KEY:
              randomBytes(32).toString('base64'),
          }),
          { db: transaction } as unknown as DatabaseService,
        );
        const session: AuthSession = {
          area: 'admin',
          user: {
            id: adminId,
            email: `pexels-admin-${adminId}@example.test`,
            displayName: 'Pexels Admin test',
            locale: null,
          },
        };
        const configuration = { apiKey };

        await expect(
          service.savePexels({ enabled: true, configuration }, session),
        ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

        await service.testPexels({ configuration }, session);
        const saved = await service.savePexels(
          { enabled: true, configuration },
          session,
        );
        expect(saved).toMatchObject({
          enabled: true,
          readiness: 'ready',
          apiKeyConfigured: true,
        });
        expect(saved).not.toHaveProperty('apiKey');

        const [stored] = await transaction
          .select({
            configurationCiphertext:
              providerIntegrations.configurationCiphertext,
          })
          .from(providerIntegrations)
          .where(eq(providerIntegrations.providerKey, 'pexels'));
        expect(stored?.configurationCiphertext).toBeTruthy();
        expect(stored?.configurationCiphertext).not.toContain(apiKey);
        await expect(service.readPexelsConfiguration()).resolves.toEqual({
          apiKey,
        });

        const disabled = await service.savePexels({ enabled: false }, session);
        expect(disabled).toMatchObject({
          enabled: false,
          readiness: 'disabled',
          apiKeyConfigured: true,
        });
        await expect(service.readPexelsConfiguration()).resolves.toBeNull();
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
