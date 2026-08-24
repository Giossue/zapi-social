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
import { WorkspacePermissionsService } from './workspace-permissions.service';

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
  readonly deliveries: Array<{
    email: string;
    token: string;
    workspaceName: string;
    inviterName: string;
    role: 'admin' | 'member';
    expiresAt: Date;
  }> = [];
  readonly notifications: Array<{ type: string; email: string }> = [];
  failNotifications = false;

  sendTeamInvitation(input: (typeof this.deliveries)[number]) {
    this.deliveries.push(input);
    return Promise.resolve();
  }

  sendTeamInvitationAccepted(input: { email: string }) {
    return this.captureNotification('invitation-accepted', input.email);
  }

  sendTeamAccessUpdated(input: { email: string }) {
    return this.captureNotification('access-updated', input.email);
  }

  sendTeamMemberRemoved(input: { email: string }) {
    return this.captureNotification('member-removed', input.email);
  }

  sendTeamOwnershipTransferred(input: {
    email: string;
    perspective: 'new-owner' | 'previous-owner';
  }) {
    return this.captureNotification(
      `ownership-${input.perspective}`,
      input.email,
    );
  }

  private captureNotification(type: string, email: string) {
    if (this.failNotifications) {
      return Promise.reject(new Error('Simulated SMTP failure.'));
    }
    this.notifications.push({ type, email });
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
    user: { ...user, locale: null },
    workspace: { ...workspace, role },
    workspaces: [{ ...workspace, role }],
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
      new WorkspacePermissionsService({ db: database } as DatabaseService),
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
      const { email, service } = serviceFor(database);

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
      await service.removeMember(scenario.adminSession, scenario.member.id);
      expect(email.notifications).toContainEqual({
        type: 'member-removed',
        email: scenario.member.email,
      });
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
      expect(email.deliveries[0]).toMatchObject({
        email: invitedUser.email,
        inviterName: scenario.owner.displayName,
        role: 'member',
        workspaceName: scenario.workspace.name,
      });
      await expect(
        service.previewInvitation({ token: originalToken }),
      ).resolves.toMatchObject({
        accountExists: true,
        invitedEmail: invitedUser.email,
        role: 'member',
        status: 'pending',
        workspaceName: scenario.workspace.name,
      });

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
      ).resolves.toMatchObject({
        accepted: true,
        workspace: { id: scenario.workspace.id, role: 'member' },
      });
      expect(email.notifications).toContainEqual({
        type: 'invitation-accepted',
        email: scenario.owner.email,
      });
      await expect(
        service.previewInvitation({ token: resentToken }),
      ).resolves.toMatchObject({ status: 'accepted' });
      await expect(
        service.acceptInvitation(invitedSession, { token: resentToken }),
      ).resolves.toMatchObject({
        accepted: true,
        workspace: { id: scenario.workspace.id },
      });
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

  it('previews invitations safely and rejects invalid, mismatched and expired access', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedTeam(database, 'invitation-errors', 6);
      const invitedUser = {
        id: randomUUID(),
        email: `new-invite-${randomUUID()}@example.test`,
        displayName: 'New invited member',
      };
      const { email, service } = serviceFor(database);
      const invitation = await service.createInvitation(scenario.ownerSession, {
        email: invitedUser.email,
        role: 'member',
      });
      const token = email.deliveries[0]?.token;
      expect(token).toBeTruthy();
      await expect(service.previewInvitation({ token })).resolves.toMatchObject(
        {
          accountExists: false,
          invitedEmail: invitedUser.email,
          status: 'pending',
        },
      );
      await expectCode(
        service.previewInvitation({ token: randomUUID() }),
        'INVITATION_INVALID',
      );
      await expectCode(
        service.acceptInvitation(scenario.memberSession, { token }),
        'INVITATION_EMAIL_MISMATCH',
      );

      await database.insert(users).values({
        ...invitedUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await database
        .update(workspaceInvitations)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(workspaceInvitations.id, invitation.id));
      await expectCode(
        service.previewInvitation({ token }),
        'INVITATION_EXPIRED',
      );
      await expectCode(
        service.acceptInvitation(
          portalSession(invitedUser, scenario.workspace, 'member'),
          { token },
        ),
        'INVITATION_EXPIRED',
      );
    });
  });

  it('keeps a pending invitation when the workspace fills before acceptance', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedTeam(database, 'acceptance-limit', 4);
      const invitedUser = {
        id: randomUUID(),
        email: `limited-invite-${randomUUID()}@example.test`,
        displayName: 'Limited invited member',
      };
      const occupyingUser = {
        id: randomUUID(),
        email: `occupying-member-${randomUUID()}@example.test`,
        displayName: 'Occupying member',
      };
      await database.insert(users).values(
        [invitedUser, occupyingUser].map((user) => ({
          ...user,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
      const { email, service } = serviceFor(database);
      const invitation = await service.createInvitation(scenario.ownerSession, {
        email: invitedUser.email,
        role: 'member',
      });
      const token = email.deliveries[0]?.token;
      expect(token).toBeTruthy();

      await database.insert(workspaceMemberships).values({
        workspaceId: scenario.workspace.id,
        userId: occupyingUser.id,
        role: 'member',
        status: 'active',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await expectCode(
        service.acceptInvitation(
          portalSession(invitedUser, scenario.workspace, 'member'),
          { token },
        ),
        'MEMBER_LIMIT_REACHED',
      );
      const [stillPending] = await database
        .select({ status: workspaceInvitations.status })
        .from(workspaceInvitations)
        .where(eq(workspaceInvitations.id, invitation.id));
      expect(stillPending?.status).toBe('pending');
    });
  });

  it('protects ownership, transfers it atomically and then allows leaving', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedTeam(database, 'ownership');
      const { email, service } = serviceFor(database);

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
      expect(email.notifications).toEqual(
        expect.arrayContaining([
          { type: 'ownership-new-owner', email: scenario.admin.email },
          { type: 'ownership-previous-owner', email: scenario.owner.email },
        ]),
      );

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
      const { email, service } = serviceFor(database);
      await service.updateMemberAccess(
        scenario.ownerSession,
        scenario.member.id,
        { role: 'member', accountIds: [scenario.accounts[1].id] },
      );
      expect(email.notifications).toContainEqual({
        type: 'access-updated',
        email: scenario.member.email,
      });

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

  it('keeps access changes when a notification cannot be delivered', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedTeam(database, 'notification-failure');
      const email = new CapturingEmailService();
      email.failNotifications = true;
      const { service } = serviceFor(database, email);

      await expect(
        service.updateMemberAccess(scenario.ownerSession, scenario.member.id, {
          role: 'member',
          accountIds: [scenario.accounts[1].id],
        }),
      ).resolves.toMatchObject({
        id: scenario.member.id,
        accountIds: [scenario.accounts[1].id],
      });

      const grants = await database
        .select({ socialAccountId: socialAccountMemberships.socialAccountId })
        .from(socialAccountMemberships)
        .where(
          eq(
            socialAccountMemberships.workspaceMembershipId,
            scenario.memberMembership.id,
          ),
        );
      expect(grants).toEqual([{ socialAccountId: scenario.accounts[1].id }]);
    });
  });

  it('grants board permissions only to the member who received them', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedTeam(database, 'permissions');
      const { service } = serviceFor(database);
      const permissions = new WorkspacePermissionsService({
        db: database,
      } as DatabaseService);

      await expect(
        permissions.allows(scenario.memberSession, 'boards.view'),
      ).resolves.toBe(false);
      await expectCode(
        permissions.require(scenario.memberSession, 'boards.view'),
        'WORKSPACE_PERMISSION_DENIED',
      );

      await expectCode(
        service.updateMemberAccess(scenario.ownerSession, scenario.member.id, {
          role: 'member',
          accountIds: [],
          permissions: ['boards.view', 'inventado'],
        }),
        'VALIDATION_FAILED',
      );

      await service.updateMemberAccess(
        scenario.ownerSession,
        scenario.member.id,
        {
          role: 'member',
          accountIds: [],
          permissions: ['boards.view', 'boards.manage_tasks'],
        },
      );

      await expect(
        permissions.allows(scenario.memberSession, 'boards.view'),
      ).resolves.toBe(true);
      await expect(
        permissions.allows(scenario.memberSession, 'boards.delete_tasks'),
      ).resolves.toBe(false);

      const [stored] = await database
        .select({ permissions: workspaceMemberships.permissions })
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.id, scenario.memberMembership.id));
      expect(stored?.permissions).toEqual([
        'boards.view',
        'boards.manage_tasks',
      ]);

      await expect(
        permissions.allows(scenario.ownerSession, 'boards.delete_tasks'),
      ).resolves.toBe(true);

      expect(
        permissions.effective('member', ['boards.view', 'boards.retirado']),
      ).toEqual(['boards.view']);

      await service.updateMemberAccess(
        scenario.ownerSession,
        scenario.member.id,
        { role: 'admin', accountIds: [], permissions: ['boards.view'] },
      );
      const [promoted] = await database
        .select({ permissions: workspaceMemberships.permissions })
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.id, scenario.memberMembership.id));
      expect(promoted?.permissions).toEqual([]);
    });
  });
});
