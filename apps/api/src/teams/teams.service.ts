import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  authSessions,
  socialAccountMemberships,
  socialAccounts,
  users,
  workspaceInvitations,
  workspaceMemberships,
} from '@workspace/database';
import { and, desc, eq, inArray, isNull } from '@workspace/database/query';
import {
  acceptPortalTeamInvitationSchema,
  createPortalTeamInvitationSchema,
  replacePortalTeamAccountGrantsSchema,
  updatePortalTeamMemberRoleSchema,
  type PortalAuthSession,
  type PortalTeamsResponse,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { AppException } from '../platform/errors/app-exception';

const managerRoles = new Set(['owner', 'admin']);

@Injectable()
export class TeamsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly email: EmailService,
  ) {}

  async list(session: PortalAuthSession): Promise<PortalTeamsResponse> {
    const [memberRows, accounts, invitations] = await Promise.all([
      this.database.db
        .select({ membership: workspaceMemberships, user: users })
        .from(workspaceMemberships)
        .innerJoin(users, eq(workspaceMemberships.userId, users.id))
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .orderBy(workspaceMemberships.joinedAt),
      this.database.db
        .select()
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.workspaceId, session.workspace.id),
            eq(socialAccounts.status, 'active'),
            isNull(socialAccounts.disconnectedAt),
          ),
        )
        .orderBy(socialAccounts.displayName),
      this.database.db
        .select()
        .from(workspaceInvitations)
        .where(
          and(
            eq(workspaceInvitations.workspaceId, session.workspace.id),
            eq(workspaceInvitations.status, 'pending'),
          ),
        )
        .orderBy(desc(workspaceInvitations.createdAt)),
    ]);
    const membershipIds = memberRows.map(({ membership }) => membership.id);
    const grants = membershipIds.length
      ? await this.database.db
          .select()
          .from(socialAccountMemberships)
          .where(
            inArray(
              socialAccountMemberships.workspaceMembershipId,
              membershipIds,
            ),
          )
      : [];
    const grantsByMembership = new Map<string, string[]>();
    for (const grant of grants) {
      const values = grantsByMembership.get(grant.workspaceMembershipId) ?? [];
      values.push(grant.socialAccountId);
      grantsByMembership.set(grant.workspaceMembershipId, values);
    }
    const allAccountIds = accounts.map(({ id }) => id);
    return {
      canManage: managerRoles.has(session.workspace.role),
      currentUserId: session.user.id,
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.displayName,
        detail: `${account.providerKey} · ${account.capabilityKey}`,
      })),
      members: memberRows.map(({ membership, user }) => ({
        id: user.id,
        name: user.displayName,
        email: user.email,
        role: membership.role as 'owner' | 'admin' | 'member',
        joinedAt: membership.joinedAt.toISOString(),
        accountIds:
          membership.role === 'member'
            ? (grantsByMembership.get(membership.id) ?? [])
            : allAccountIds,
      })),
      invitations: invitations
        .filter((invitation) => invitation.expiresAt > new Date())
        .map((invitation) => ({
          id: invitation.id,
          email: invitation.emailNormalized,
          role: invitation.role as 'admin' | 'member',
          expiresAt: invitation.expiresAt.toISOString(),
        })),
    };
  }

  async createInvitation(session: PortalAuthSession, input: unknown) {
    this.requireManage(session);
    const parsed = createPortalTeamInvitationSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    if (parsed.data.role === 'admin' && session.workspace.role !== 'owner')
      throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.FORBIDDEN);
    const email = parsed.data.email.toLocaleLowerCase('en-US');
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [invitation] = await this.database.db.transaction(async (tx) => {
      await tx
        .update(workspaceInvitations)
        .set({ status: 'revoked', updatedAt: now })
        .where(
          and(
            eq(workspaceInvitations.workspaceId, session.workspace.id),
            eq(workspaceInvitations.emailNormalized, email),
            eq(workspaceInvitations.status, 'pending'),
          ),
        );
      const [created] = await tx
        .insert(workspaceInvitations)
        .values({
          workspaceId: session.workspace.id,
          invitedByUserId: session.user.id,
          emailNormalized: email,
          role: parsed.data.role,
          tokenHash: this.hash(token),
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created)
        throw new AppException('REQUEST_FAILED', HttpStatus.CONFLICT);
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'team.invitation_created',
        subjectType: 'workspace_invitation',
        subjectId: created.id,
        summary: 'Workspace invitation created',
        metadata: { role: created.role },
      });
      return [created];
    });
    if (!invitation)
      throw new AppException('REQUEST_FAILED', HttpStatus.CONFLICT);
    try {
      await this.email.sendTeamInvitation(email, token);
    } catch (error) {
      await this.database.db
        .update(workspaceInvitations)
        .set({ status: 'revoked', updatedAt: new Date() })
        .where(
          and(
            eq(workspaceInvitations.id, invitation.id),
            eq(workspaceInvitations.status, 'pending'),
          ),
        );
      throw error;
    }
    return {
      id: invitation.id,
      email,
      role: invitation.role,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async revokeInvitation(
    session: PortalAuthSession,
    invitationId: string,
  ): Promise<void> {
    this.requireManage(session);
    const [invitation] = await this.database.db
      .select()
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.id, invitationId),
          eq(workspaceInvitations.workspaceId, session.workspace.id),
        ),
      )
      .limit(1);
    if (!invitation || invitation.status !== 'pending') return;
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(workspaceInvitations)
        .set({ status: 'revoked', updatedAt: now })
        .where(eq(workspaceInvitations.id, invitation.id));
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'team.invitation_revoked',
        subjectType: 'workspace_invitation',
        subjectId: invitation.id,
        summary: 'Workspace invitation revoked',
        metadata: {},
      });
    });
  }

  async acceptInvitation(session: PortalAuthSession, input: unknown) {
    const parsed = acceptPortalTeamInvitationSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const tokenHash = this.hash(parsed.data.token);
    const [invitation] = await this.database.db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.tokenHash, tokenHash))
      .limit(1);
    if (!invitation || invitation.status !== 'pending')
      throw new AppException('INVITATION_ALREADY_USED', HttpStatus.CONFLICT);
    if (invitation.expiresAt <= new Date()) {
      await this.database.db
        .update(workspaceInvitations)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(workspaceInvitations.id, invitation.id));
      throw new AppException('INVITATION_EXPIRED', HttpStatus.GONE);
    }
    if (
      invitation.emailNormalized !==
      session.user.email.toLocaleLowerCase('en-US')
    )
      throw new AppException('INVITATION_EMAIL_MISMATCH', HttpStatus.FORBIDDEN);
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: workspaceMemberships.id })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, invitation.workspaceId),
            eq(workspaceMemberships.userId, session.user.id),
          ),
        )
        .limit(1);
      if (existing)
        throw new AppException('INVITATION_ALREADY_USED', HttpStatus.CONFLICT);
      await tx.insert(workspaceMemberships).values({
        workspaceId: invitation.workspaceId,
        userId: session.user.id,
        role: invitation.role,
        status: 'active',
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      const [consumed] = await tx
        .update(workspaceInvitations)
        .set({
          status: 'accepted',
          acceptedByUserId: session.user.id,
          acceptedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceInvitations.id, invitation.id),
            eq(workspaceInvitations.status, 'pending'),
          ),
        )
        .returning({ id: workspaceInvitations.id });
      if (!consumed)
        throw new AppException('INVITATION_ALREADY_USED', HttpStatus.CONFLICT);
      await tx.insert(apiAuditLogs).values({
        workspaceId: invitation.workspaceId,
        actorUserId: session.user.id,
        event: 'team.invitation_accepted',
        subjectType: 'workspace_invitation',
        subjectId: invitation.id,
        summary: 'Workspace invitation accepted',
        metadata: {},
      });
    });
    return { accepted: true as const };
  }

  async updateMemberRole(
    session: PortalAuthSession,
    userId: string,
    input: unknown,
  ) {
    const parsed = updatePortalTeamMemberRoleSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    if (session.workspace.role !== 'owner' || parsed.data.role === 'owner')
      throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.FORBIDDEN);
    const [member] = await this.database.db
      .select()
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, session.workspace.id),
          eq(workspaceMemberships.userId, userId),
          eq(workspaceMemberships.status, 'active'),
        ),
      )
      .limit(1);
    if (!member || member.role === 'owner')
      throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.FORBIDDEN);
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(workspaceMemberships)
        .set({ role: parsed.data.role, updatedAt: now })
        .where(eq(workspaceMemberships.id, member.id));
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'team.member_role_updated',
        subjectType: 'workspace_membership',
        subjectId: member.id,
        summary: 'Workspace member role updated',
        metadata: { role: parsed.data.role },
      });
    });
    return { id: userId, role: parsed.data.role };
  }

  async replaceAccountGrants(
    session: PortalAuthSession,
    userId: string,
    input: unknown,
  ) {
    this.requireManage(session);
    const parsed = replacePortalTeamAccountGrantsSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const [member] = await this.database.db
      .select()
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, session.workspace.id),
          eq(workspaceMemberships.userId, userId),
          eq(workspaceMemberships.status, 'active'),
        ),
      )
      .limit(1);
    if (!member || member.role !== 'member')
      throw new AppException('ACCOUNT_GRANT_NOT_ALLOWED', HttpStatus.FORBIDDEN);
    const uniqueIds = [...new Set(parsed.data.accountIds)];
    const accounts = uniqueIds.length
      ? await this.database.db
          .select({ id: socialAccounts.id })
          .from(socialAccounts)
          .where(
            and(
              eq(socialAccounts.workspaceId, session.workspace.id),
              inArray(socialAccounts.id, uniqueIds),
            ),
          )
      : [];
    if (accounts.length !== uniqueIds.length)
      throw new AppException('ACCOUNT_GRANT_NOT_ALLOWED', HttpStatus.FORBIDDEN);
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx
        .delete(socialAccountMemberships)
        .where(eq(socialAccountMemberships.workspaceMembershipId, member.id));
      if (uniqueIds.length)
        await tx.insert(socialAccountMemberships).values(
          uniqueIds.map((socialAccountId) => ({
            socialAccountId,
            workspaceMembershipId: member.id,
            createdAt: now,
            updatedAt: now,
          })),
        );
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'team.member_account_grants_replaced',
        subjectType: 'workspace_membership',
        subjectId: member.id,
        summary: 'Workspace member account grants replaced',
        metadata: { count: uniqueIds.length },
      });
    });
    return { accountIds: uniqueIds, userId };
  }

  async removeMember(
    session: PortalAuthSession,
    userId: string,
  ): Promise<void> {
    this.requireManage(session);
    const [member] = await this.database.db
      .select()
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, session.workspace.id),
          eq(workspaceMemberships.userId, userId),
          eq(workspaceMemberships.status, 'active'),
        ),
      )
      .limit(1);
    if (!member || member.role === 'owner' || userId === session.user.id)
      throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
    if (session.workspace.role === 'admin' && member.role !== 'member')
      throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx
        .delete(socialAccountMemberships)
        .where(eq(socialAccountMemberships.workspaceMembershipId, member.id));
      await tx
        .update(workspaceMemberships)
        .set({ status: 'revoked', updatedAt: now })
        .where(eq(workspaceMemberships.id, member.id));
      await tx
        .update(authSessions)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(authSessions.userId, userId),
            eq(authSessions.activeWorkspaceId, session.workspace.id),
          ),
        );
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'team.member_revoked',
        subjectType: 'workspace_membership',
        subjectId: member.id,
        summary: 'Workspace member revoked',
        metadata: {},
      });
    });
  }

  private requireManage(session: PortalAuthSession) {
    if (!managerRoles.has(session.workspace.role))
      throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
