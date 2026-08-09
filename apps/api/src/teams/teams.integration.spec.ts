import { randomUUID } from 'node:crypto';
import {
  createDatabase,
  socialAccountMemberships,
  socialAccounts,
  users,
  workspaceInvitations,
  workspaceMemberships,
  workspaces,
  type Database,
} from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import type { PortalAuthSession } from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { AppException } from '../platform/errors/app-exception';
import { TeamsService } from './teams.service';

const databaseUrl = process.env.TEAMS_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();
const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback Teams integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

type TeamRole = 'owner' | 'admin' | 'member';

class CapturingEmailService {
  readonly deliveries: Array<{ email: string; token: string }> = [];

  sendTeamInvitation(email: string, token: string) {
    this.deliveries.push({ email, token });
    return Promise.resolve();
  }
}

function portalSession(
  user: { id: string; email: string; displayName: string },
  workspace: { id: string; name: string; slug: string },
  role: TeamRole,
): PortalAuthSession {
  return {
    area: 'portal',
    user,
    workspace: { ...workspace, role },
  };
}

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) throw new Error('Local Teams database is unavailable.');
  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function seedTeam(database: Database, suffix: string, memberLimit = 5) {
  const now = new Date();
  const workspace = {
    id: randomUUID(),
    name: `Teams ${suffix}`,
    slug: `teams-${suffix}-${randomUUID().slice(0, 8)}`,
  };
  const owner = {
    id: randomUUID(),
    email: `owner-${suffix}-${randomUUID()}@example.test`,
    displayName: `Owner ${suffix}`,
  };
  const admin = {
    id: randomUUID(),
    email: `admin-${suffix}-${randomUUID()}@example.test`,
    displayName: `Admin ${suffix}`,
  };
  const member = {
    id: randomUUID(),
    email: `member-${suffix}-${randomUUID()}@example.test`,
    displayName: `Member ${suffix}`,
  };
  await database.insert(users).values(
    [owner, admin, member].map((user) => ({
      ...user,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await database.insert(workspaces).values({
    ...workspace,
    ownerUserId: owner.id,
    memberLimit,
    createdAt: now,
    updatedAt: now,
  });
  const memberships = await database
    .insert(workspaceMemberships)
    .values(
      [
        { user: owner, role: 'owner' as const },
        { user: admin, role: 'admin' as const },
        { user: member, role: 'member' as const },
      ].map(({ user, role }) => ({
        workspaceId: workspace.id,
        userId: user.id,
        role,
        status: 'active',
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .returning();
  const memberMembership = memberships.find(
    (membership) => membership.userId === member.id,
  );
  if (!memberMembership) throw new Error('Unable to seed member.');
  const accounts = await database
    .insert(socialAccounts)
    .values([
      {
        workspaceId: workspace.id,
        providerKey: 'meta',
        capabilityKey: 'facebook_page',
        displayName: `Granted ${suffix}`,
        createdAt: now,
        updatedAt: now,
      },
      {
        workspaceId: workspace.id,
        providerKey: 'meta',
        capabilityKey: 'instagram_profile',
        displayName: `Private ${suffix}`,
        createdAt: now,
        updatedAt: now,
      },
    ])
    .returning();
  await database.insert(socialAccountMemberships).values({
    workspaceMembershipId: memberMembership.id,
    socialAccountId: accounts[0].id,
    createdAt: now,
    updatedAt: now,
  });

  return {
    accounts,
    admin,
    adminSession: portalSession(admin, workspace, 'admin'),
    member,
    memberMembership,
    memberSession: portalSession(member, workspace, 'member'),
    owner,
    ownerSession: portalSession(owner, workspace, 'owner'),
    workspace,
  };
}

function serviceFor(database: Database, email = new CapturingEmailService()) {
  return {
    email,
    service: new TeamsService(
      { db: database } as DatabaseService,
      email as unknown as EmailService,
    ),
  };
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

describeDatabase('Teams lifecycle', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('shows managers full data and limits members to their own access', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedTeam(database, 'privacy');
      const { service } = serviceFor(database);

      const managerView = await service.list(scenario.ownerSession);
      const adminView = await service.list(scenario.adminSession);
      const memberView = await service.list(scenario.memberSession);

      expect(managerView.canManage).toBe(true);
      expect(adminView.canManage).toBe(true);
      expect(adminView.canInviteAdmin).toBe(false);
      expect(managerView.members.every(({ email }) => email !== null)).toBe(
        true,
      );
      expect(memberView.canManage).toBe(false);
      expect(memberView.invitations).toEqual([]);
      expect(memberView.accounts.map(({ id }) => id)).toEqual([
        scenario.accounts[0].id,
      ]);
      expect(
        memberView.members.find(({ id }) => id === scenario.member.id)?.email,
      ).toBe(scenario.member.email);
      expect(
        memberView.members.find(({ id }) => id === scenario.owner.id)?.email,
      ).toBeNull();
      expect(memberView.seatUsage).toMatchObject({
        activeMembers: 3,
        pendingInvitations: 0,
        used: 3,
        limit: 5,
      });
      await expectCode(
        service.createInvitation(scenario.memberSession, {
          email: `blocked-${randomUUID()}@example.test`,
          role: 'member',
        }),
        'TEAM_ACCESS_DENIED',
      );
      await expectCode(
        service.createInvitation(scenario.adminSession, {
          email: `admin-${randomUUID()}@example.test`,
          role: 'admin',
        }),
        'ROLE_CHANGE_NOT_ALLOWED',
      );
      await expectCode(
        service.updateMemberAccess(scenario.adminSession, scenario.member.id, {
          role: 'admin',
          accountIds: [],
        }),
        'ROLE_CHANGE_NOT_ALLOWED',
      );
    });
  });

  it('enforces seats and duplicates while resend invalidates the old token', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedTeam(database, 'invites', 4);
      const invitedUser = {
        id: randomUUID(),
        email: `invited-${randomUUID()}@example.test`,
        displayName: 'Invited member',
      };
      await database.insert(users).values({
        ...invitedUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const { email, service } = serviceFor(database);
      const invitation = await service.createInvitation(scenario.ownerSession, {
        email: invitedUser.email,
        role: 'member',
      });
      const originalToken = email.deliveries[0]?.token;
      expect(invitation.deliveryStatus).toBe('sent');
      expect(originalToken).toBeTruthy();

      await expectCode(
        service.createInvitation(scenario.ownerSession, {
          email: invitedUser.email,
          role: 'member',
        }),
        'INVITATION_ALREADY_PENDING',
      );
      await expectCode(
        service.createInvitation(scenario.ownerSession, {
          email: `overflow-${randomUUID()}@example.test`,
          role: 'member',
        }),
        'MEMBER_LIMIT_REACHED',
      );

      const resent = await service.resendInvitation(
        scenario.ownerSession,
        invitation.id,
      );
      const resentToken = email.deliveries[1]?.token;
      expect(resent.deliveryStatus).toBe('sent');
      expect(resentToken).toBeTruthy();
      expect(resentToken).not.toBe(originalToken);

      const invitedSession = portalSession(
        invitedUser,
        scenario.workspace,
        'member',
      );
      await expectCode(
        service.acceptInvitation(invitedSession, { token: originalToken }),
        'INVITATION_ALREADY_USED',
      );
      await expect(
        service.acceptInvitation(invitedSession, { token: resentToken }),
      ).resolves.toEqual({ accepted: true });
      const [membership] = await database
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, scenario.workspace.id),
            eq(workspaceMemberships.userId, invitedUser.id),
          ),
        );
      expect(membership?.status).toBe('active');
      const [acceptedInvitation] = await database
        .select()
        .from(workspaceInvitations)
        .where(eq(workspaceInvitations.id, invitation.id));
      const [teamWorkspace] = await database
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, scenario.workspace.id));
      expect(acceptedInvitation?.status).toBe('accepted');
      expect(teamWorkspace?.kind).toBe('team');

      await service.revokeInvitation(scenario.ownerSession, invitation.id);
      const [stillAccepted] = await database
        .select({ status: workspaceInvitations.status })
        .from(workspaceInvitations)
        .where(eq(workspaceInvitations.id, invitation.id));
      expect(stillAccepted?.status).toBe('accepted');
    });
  });

  it('protects ownership, transfers it atomically and then allows leaving', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedTeam(database, 'ownership');
      const { service } = serviceFor(database);

      await database.insert(workspaces).values({
        name: 'Admin personal workspace',
        slug: `admin-personal-${randomUUID().slice(0, 8)}`,
        ownerUserId: scenario.admin.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expectCode(
        service.leaveWorkspace(scenario.ownerSession),
        'LAST_OWNER_PROTECTED',
      );
      await expectCode(
        service.transferOwnership(scenario.adminSession, {
          targetUserId: scenario.member.id,
        }),
        'TEAM_ACCESS_DENIED',
      );
      await expect(
        service.transferOwnership(scenario.ownerSession, {
          targetUserId: scenario.admin.id,
        }),
      ).resolves.toEqual({ ownerUserId: scenario.admin.id });

      const [workspace] = await database
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, scenario.workspace.id));
      const memberships = await database
        .select()
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.workspaceId, scenario.workspace.id));
      expect(workspace?.ownerUserId).toBe(scenario.admin.id);
      expect(workspace?.kind).toBe('team');
      expect(
        memberships.find(({ userId }) => userId === scenario.owner.id)?.role,
      ).toBe('admin');
      expect(
        memberships.find(({ userId }) => userId === scenario.admin.id)?.role,
      ).toBe('owner');

      await expect(
        service.leaveWorkspace({
          ...scenario.ownerSession,
          workspace: { ...scenario.ownerSession.workspace, role: 'admin' },
        }),
      ).resolves.toEqual({ left: true });
      const [formerOwner] = await database
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, scenario.workspace.id),
            eq(workspaceMemberships.userId, scenario.owner.id),
          ),
        );
      expect(formerOwner?.status).toBe('revoked');
    });
  });

  it('exposes filtered activity only to managers', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedTeam(database, 'activity');
      const { service } = serviceFor(database);
      await service.updateMemberAccess(
        scenario.ownerSession,
        scenario.member.id,
        { role: 'member', accountIds: [scenario.accounts[1].id] },
      );

      const access = await service.listActivity(scenario.ownerSession, {
        category: 'access',
        page: 1,
        limit: 10,
      });
      expect(access.total).toBe(1);
      expect(access.events[0]?.type).toBe('team.member_access_updated');
      expect(access.events[0]?.subjectName).toBe(scenario.member.displayName);
      await expectCode(
        service.listActivity(scenario.memberSession, {}),
        'TEAM_ACCESS_DENIED',
      );
    });
  });
});
