import { randomBytes, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  createDatabase,
  users,
  workspaceMemberships,
  workspaces,
  type Database,
} from '@workspace/database';
import type { PortalAuthSession } from '@workspace/contracts';
import { AutomationEventsService } from '../automation/automation-events.service';
import { DatabaseService } from '../database/database.service';
import { TeamAccountAccessService } from '../teams/team-account-access.service';
import { AdminAiService } from './admin-ai.service';
import { AiService } from './ai.service';

const databaseUrl = process.env.DATABASE_URL;
const isLocalDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();
const describeDatabase = isLocalDatabase ? describe : describe.skip;
const rollback = new Error('Rollback AI integration test.');
const connection = isLocalDatabase ? createDatabase(databaseUrl!) : null;

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) throw new Error('Local AI test database is unavailable.');
  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function seedWorkspace(database: Database) {
  const now = new Date();
  const user = {
    id: randomUUID(),
    email: `ai-${randomUUID()}@example.test`,
    displayName: 'AI Owner',
  };
  const workspace = {
    id: randomUUID(),
    name: 'AI Test',
    slug: `ai-test-${randomUUID().slice(0, 8)}`,
  };
  await database
    .insert(users)
    .values({ ...user, createdAt: now, updatedAt: now });
  await database.insert(workspaces).values({
    ...workspace,
    ownerUserId: user.id,
    createdAt: now,
    updatedAt: now,
  });
  await database.insert(workspaceMemberships).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: 'owner',
    status: 'active',
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  const session: PortalAuthSession = {
    area: 'portal',
    user,
    workspace: { ...workspace, role: 'owner' },
    workspaces: [{ ...workspace, role: 'owner' }],
  };
  return { user, workspace, session };
}

describeDatabase('AI Studio integration', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('persists workspace settings and budget without exposing provider secrets', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedWorkspace(database);
      const databaseService = { db: database } as DatabaseService;
      const service = new AiService(
        databaseService,
        new TeamAccountAccessService(databaseService),
        { emit: () => Promise.resolve() } as unknown as AutomationEventsService,
        { add: () => Promise.resolve() } as never,
      );

      const settings = await service.updateSettings(scenario.session, {
        brandName: 'Marca segura',
        brandDescription: 'Descripción de pruebas',
        brandPersonality: 'cercana',
        preferredWords: ['claro'],
        forbiddenWords: ['secreto'],
        requireHumanReview: true,
      });
      expect(settings).toMatchObject({
        brandName: 'Marca segura',
        brandPersonality: 'cercana',
        requireHumanReview: true,
      });

      const credits = await service.updateBudget(scenario.session, {
        monthlyMicrousd: 50_000_000,
        alertPercent: 75,
        alertsEnabled: true,
      });
      expect(credits.budget).toEqual({
        monthlyMicrousd: 50_000_000,
        alertPercent: 75,
        alertsEnabled: true,
      });
      expect(credits.costs).toHaveLength(9);
    });
  });

  it('loads OpenAI and AtlasCloud models and rejects incompatible routing', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedWorkspace(database);
      const service = new AdminAiService(
        { db: database } as DatabaseService,
        new ConfigService({
          PROVIDER_INTEGRATIONS_ENCRYPTION_KEY:
            randomBytes(32).toString('base64'),
        }),
      );
      const session = { area: 'admin' as const, user: scenario.user };
      const configuration = await service.configuration();
      expect(configuration.providers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            providerKey: 'openai',
            apiKeyConfigured: false,
          }),
          expect.objectContaining({
            providerKey: 'atlascloud',
            apiKeyConfigured: false,
          }),
        ]),
      );
      expect(configuration.models.map((model) => model.modelId)).toEqual(
        expect.arrayContaining([
          'gpt-5.6-sol',
          'gpt-5.6-terra',
          'gpt-5.6-luna',
          'openai/gpt-image-2/text-to-image',
          'bytedance/seedance-2.0/text-to-video',
        ]),
      );
      const imageModel = configuration.models.find(
        (model) => model.capability === 'image',
      );
      try {
        await service.updateRoute(
          'content',
          {
            primaryModelId: imageModel?.id ?? null,
            fallbackModelId: null,
            referenceModelId: null,
            referenceFallbackModelId: null,
            reasoningEffort: 'medium',
            costUnits: 2,
            enabled: true,
          },
          session,
        );
        throw new Error('Expected incompatible routing to be rejected');
      } catch (error) {
        expect((error as { code?: string }).code).toBe(
          'AI_MODEL_ROUTE_INVALID',
        );
      }
    });
  });
});
