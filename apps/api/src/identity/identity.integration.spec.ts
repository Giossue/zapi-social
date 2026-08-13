import { createHash, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import {
  authSessions,
  createDatabase,
  users,
  workspaceMemberships,
  workspaces,
  type Database,
} from '@workspace/database';
import { eq } from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { CaptchaService } from '../captcha/captcha.service';
import { IdentityService } from './identity.service';

const databaseUrl = process.env.IDENTITY_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();
const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback Identity integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;
const captchaDisabled = {
  verifyAuthenticationToken: () => Promise.resolve(),
} as unknown as CaptchaService;

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) throw new Error('Local Identity database is unavailable.');
  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function expectCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe(code);
  }
}

describeDatabase('Identity workspace context', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('requires and persists the registration timezone', async () => {
    await inRollbackTransaction(async (database) => {
      const service = new IdentityService(
        { db: database } as DatabaseService,
        new JwtService({ secret: 'identity-timezone-test-secret' }),
        captchaDisabled,
      );
      const email = `timezone-user-${randomUUID()}@example.test`;

      await expectCode(
        service.register({
          displayName: 'Missing timezone',
          email: `missing-timezone-${randomUUID()}@example.test`,
          password: 'Valid-password-1!',
        }),
        'VALIDATION_FAILED',
      );

      await service.register({
        displayName: 'Timezone user',
        email,
        password: 'Valid-password-1!',
        timezone: 'America/Guayaquil',
      });

      const [storedUser] = await database
        .select({
          isPlatformAdmin: users.isPlatformAdmin,
          timezone: users.timezone,
        })
        .from(users)
        .where(eq(users.email, email));
      expect(storedUser?.timezone).toBe('America/Guayaquil');
      expect(storedUser?.isPlatformAdmin).toBe(false);
    });
  });

  it('lists memberships and activates only a workspace available to the session user', async () => {
    await inRollbackTransaction(async (database) => {
      const now = new Date();
      const user = {
        id: randomUUID(),
        email: `workspace-user-${randomUUID()}@example.test`,
        displayName: 'Workspace user',
      };
      const otherOwner = {
        id: randomUUID(),
        email: `workspace-owner-${randomUUID()}@example.test`,
        displayName: 'Workspace owner',
      };
      await database.insert(users).values([
        { ...user, createdAt: now, updatedAt: now },
        { ...otherOwner, createdAt: now, updatedAt: now },
      ]);
      const [personalWorkspace, teamWorkspace, unavailableWorkspace] =
        await database
          .insert(workspaces)
          .values([
            {
              ownerUserId: user.id,
              name: 'Personal workspace',
              slug: `personal-${randomUUID().slice(0, 8)}`,
              createdAt: now,
              updatedAt: now,
            },
            {
              ownerUserId: otherOwner.id,
              name: 'Invited workspace',
              slug: `invited-${randomUUID().slice(0, 8)}`,
              kind: 'team',
              createdAt: now,
              updatedAt: now,
            },
            {
              ownerUserId: otherOwner.id,
              name: 'Unavailable workspace',
              slug: `unavailable-${randomUUID().slice(0, 8)}`,
              kind: 'team',
              createdAt: now,
              updatedAt: now,
            },
          ])
          .returning();
      if (!personalWorkspace || !teamWorkspace || !unavailableWorkspace) {
        throw new Error('Unable to seed workspaces.');
      }
      await database.insert(workspaceMemberships).values([
        {
          workspaceId: personalWorkspace.id,
          userId: user.id,
          role: 'owner',
          joinedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          workspaceId: teamWorkspace.id,
          userId: user.id,
          role: 'member',
          joinedAt: new Date(now.getTime() + 1),
          createdAt: now,
          updatedAt: now,
        },
        {
          workspaceId: teamWorkspace.id,
          userId: otherOwner.id,
          role: 'owner',
          joinedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      const sessionToken = randomUUID();
      const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
      await database.insert(authSessions).values({
        userId: user.id,
        tokenHash,
        activeWorkspaceId: personalWorkspace.id,
        remembered: true,
        expiresAt: new Date(now.getTime() + 60_000),
        createdAt: now,
        updatedAt: now,
      });

      const service = new IdentityService(
        { db: database } as DatabaseService,
        new JwtService({ secret: 'identity-workspace-test-secret' }),
        captchaDisabled,
      );
      const initial = await service.getSession(sessionToken);
      expect(initial?.area).toBe('portal');
      if (initial?.area !== 'portal')
        throw new Error('Portal session expected.');
      expect(initial.workspace.id).toBe(personalWorkspace.id);
      expect(initial.workspaces.map(({ id }) => id)).toEqual([
        personalWorkspace.id,
        teamWorkspace.id,
      ]);

      const activated = await service.activateWorkspace(sessionToken, {
        workspaceId: teamWorkspace.id,
      });
      expect(activated.session).toMatchObject({
        area: 'portal',
        workspace: { id: teamWorkspace.id, role: 'member' },
      });
      expect(activated.accessToken).toEqual(expect.any(String));
      const [storedSession] = await database
        .select({ activeWorkspaceId: authSessions.activeWorkspaceId })
        .from(authSessions)
        .where(eq(authSessions.tokenHash, tokenHash));
      expect(storedSession?.activeWorkspaceId).toBe(teamWorkspace.id);

      await expectCode(
        service.activateWorkspace(sessionToken, {
          workspaceId: unavailableWorkspace.id,
        }),
        'AUTH_WORKSPACE_UNAVAILABLE',
      );
      const refreshed = await service.getSession(sessionToken);
      expect(refreshed?.area).toBe('portal');
      if (refreshed?.area !== 'portal')
        throw new Error('Portal session expected.');
      expect(refreshed.workspace.id).toBe(teamWorkspace.id);
    });
  });
});
