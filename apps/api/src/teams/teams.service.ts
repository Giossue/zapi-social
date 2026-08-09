import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  authSessions,
  socialAccountMemberships,
  socialAccounts,
  users,
  workspaceInvitations,
  workspaceMembershipAuditEvents,
  workspaceMemberships,
  workspaces,
} from '@workspace/database';
import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  sql,
} from '@workspace/database/query';
import {
  acceptPortalTeamInvitationSchema,
  createPortalTeamInvitationSchema,
  portalTeamActivityQuerySchema,
  replacePortalTeamAccountGrantsSchema,
  transferPortalTeamOwnershipSchema,
  updatePortalTeamMemberAccessSchema,
  updatePortalTeamMemberRoleSchema,
  type PortalAuthSession,
  type PortalTeamActivityCategory,
  type PortalTeamActivityEventType,
  type PortalTeamActivityResponse,
  type PortalTeamInvitation,
  type PortalTeamsResponse,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { AppException } from '../platform/errors/app-exception';

const managerRoles = new Set(['owner', 'admin']);
const invitationLifetimeMilliseconds = 7 * 24 * 60 * 60 * 1000;
const activityTypes = new Set<PortalTeamActivityEventType>([
  'team.invitation_created',
  'team.invitation_resent',
  'team.invitation_revoked',
  'team.invitation_expired',
  'team.invitation_accepted',
  'team.member_role_updated',
  'team.member_access_updated',
  'team.member_account_grants_replaced',
  'team.member_revoked',
  'team.member_left',
  'team.ownership_transferred',
]);
const activityTypesByCategory: Record<
  Exclude<PortalTeamActivityCategory, 'all'>,
  PortalTeamActivityEventType[]
> = {
  invitations: [
    'team.invitation_created',
    'team.invitation_resent',
    'team.invitation_revoked',
    'team.invitation_expired',
    'team.invitation_accepted',
  ],
  members: [
    'team.member_role_updated',
    'team.member_revoked',
    'team.member_left',
  ],
  access: ['team.member_access_updated', 'team.member_account_grants_replaced'],
  ownership: ['team.ownership_transferred'],
};

@Injectable()
export class TeamsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly email: EmailService,
  ) {}

  async list(session: PortalAuthSession): Promise<PortalTeamsResponse> {
    await this.expirePendingInvitations(session.workspace.id);
    const canManage = managerRoles.has(session.workspace.role);
    const now = new Date();
    const [
      workspaceRows,
      memberRows,
      allAccounts,
      invitationRows,
      pendingInvitationRows,
    ] = await Promise.all([
      this.database.db
        .select({
          id: workspaces.id,
          memberLimit: workspaces.memberLimit,
          name: workspaces.name,
        })
        .from(workspaces)
        .where(eq(workspaces.id, session.workspace.id))
        .limit(1),
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
      canManage
        ? this.database.db
            .select({ invitation: workspaceInvitations, inviter: users })
            .from(workspaceInvitations)
            .innerJoin(
              users,
              eq(workspaceInvitations.invitedByUserId, users.id),
            )
            .where(
              and(
                eq(workspaceInvitations.workspaceId, session.workspace.id),
                eq(workspaceInvitations.status, 'pending'),
                gt(workspaceInvitations.expiresAt, now),
              ),
            )
            .orderBy(desc(workspaceInvitations.createdAt))
        : Promise.resolve([]),
      this.database.db
        .select({ total: count() })
        .from(workspaceInvitations)
        .where(
          and(
            eq(workspaceInvitations.workspaceId, session.workspace.id),
            eq(workspaceInvitations.status, 'pending'),
            gt(workspaceInvitations.expiresAt, now),
          ),
        ),
    ]);
    const workspace = workspaceRows[0];
    if (!workspace)
      throw new AppException(
        'AUTH_WORKSPACE_UNAVAILABLE',
        HttpStatus.NOT_FOUND,
      );

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

    const currentMembership = memberRows.find(
      ({ user }) => user.id === session.user.id,
    )?.membership;
    const visibleAccountIds = canManage
      ? null
      : new Set(
          currentMembership
            ? (grantsByMembership.get(currentMembership.id) ?? [])
            : [],
        );
    const accounts = visibleAccountIds
      ? allAccounts.filter(({ id }) => visibleAccountIds.has(id))
      : allAccounts;
    const allAccountIds = allAccounts.map(({ id }) => id);
    const pendingInvitations = Number(pendingInvitationRows[0]?.total ?? 0);

    return {
      canManage,
      canInviteAdmin: session.workspace.role === 'owner',
      canViewActivity: canManage,
      currentUserId: session.user.id,
      currentUserRole: session.workspace.role as 'owner' | 'admin' | 'member',
      workspace: { id: workspace.id, name: workspace.name },
      seatUsage: {
        activeMembers: memberRows.length,
        pendingInvitations,
        used: memberRows.length + pendingInvitations,
        limit: workspace.memberLimit,
      },
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.displayName,
        detail: `${account.providerKey} · ${account.capabilityKey}`,
      })),
      members: memberRows.map(({ membership, user }) => ({
        id: user.id,
        name: user.displayName,
        email: canManage || user.id === session.user.id ? user.email : null,
        role: membership.role as 'owner' | 'admin' | 'member',
        joinedAt: membership.joinedAt.toISOString(),
        accountIds:
          canManage || user.id === session.user.id
            ? membership.role === 'member'
              ? (grantsByMembership.get(membership.id) ?? [])
              : allAccountIds
            : [],
      })),
      invitations: invitationRows.map(({ invitation, inviter }) =>
        this.serializeInvitation(invitation, inviter.displayName),
      ),
    };
  }

  async createInvitation(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalTeamInvitation> {
    this.requireManage(session);
    const parsed = createPortalTeamInvitationSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    if (parsed.data.role === 'admin' && session.workspace.role !== 'owner')
      throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.FORBIDDEN);

    const email = parsed.data.email.toLocaleLowerCase('en-US');
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + invitationLifetimeMilliseconds);
    const invitation = await this.database.db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: workspaces.id, memberLimit: workspaces.memberLimit })
        .from(workspaces)
        .where(eq(workspaces.id, session.workspace.id))
        .for('update')
        .limit(1);
      if (!workspace)
        throw new AppException(
          'AUTH_WORKSPACE_UNAVAILABLE',
          HttpStatus.NOT_FOUND,
        );
      const [actor] = await tx
        .select({ role: workspaceMemberships.role })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, session.user.id),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .limit(1);
      if (!actor || !managerRoles.has(actor.role))
        throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
      if (parsed.data.role === 'admin' && actor.role !== 'owner')
        throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.FORBIDDEN);

      const [existingMember] = await tx
        .select({ id: workspaceMemberships.id })
        .from(workspaceMemberships)
        .innerJoin(users, eq(workspaceMemberships.userId, users.id))
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.status, 'active'),
            sql`lower(${users.email}) = ${email}`,
          ),
        )
        .limit(1);
      if (existingMember)
        throw new AppException(
          'TEAM_MEMBER_ALREADY_EXISTS',
          HttpStatus.CONFLICT,
        );

      const [existingInvitation] = await tx
        .select({ id: workspaceInvitations.id })
        .from(workspaceInvitations)
        .where(
          and(
            eq(workspaceInvitations.workspaceId, session.workspace.id),
            eq(workspaceInvitations.emailNormalized, email),
            eq(workspaceInvitations.status, 'pending'),
            gt(workspaceInvitations.expiresAt, now),
          ),
        )
        .limit(1);
      if (existingInvitation)
        throw new AppException(
          'INVITATION_ALREADY_PENDING',
          HttpStatus.CONFLICT,
        );

      const expiredInvitations = await tx
        .update(workspaceInvitations)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            eq(workspaceInvitations.workspaceId, session.workspace.id),
            eq(workspaceInvitations.emailNormalized, email),
            eq(workspaceInvitations.status, 'pending'),
            lte(workspaceInvitations.expiresAt, now),
          ),
        )
        .returning({ email: workspaceInvitations.emailNormalized });
      if (expiredInvitations.length) {
        await tx.insert(workspaceMembershipAuditEvents).values(
          expiredInvitations.map(({ email: expiredEmail }) => ({
            workspaceId: session.workspace.id,
            type: 'team.invitation_expired',
            metadata: { email: expiredEmail },
          })),
        );
      }

      const [activeRows, pendingRows] = await Promise.all([
        tx
          .select({ total: count() })
          .from(workspaceMemberships)
          .where(
            and(
              eq(workspaceMemberships.workspaceId, session.workspace.id),
              eq(workspaceMemberships.status, 'active'),
            ),
          ),
        tx
          .select({ total: count() })
          .from(workspaceInvitations)
          .where(
            and(
              eq(workspaceInvitations.workspaceId, session.workspace.id),
              eq(workspaceInvitations.status, 'pending'),
              gt(workspaceInvitations.expiresAt, now),
            ),
          ),
      ]);
      const used =
        Number(activeRows[0]?.total ?? 0) + Number(pendingRows[0]?.total ?? 0);
      if (workspace.memberLimit !== null && used >= workspace.memberLimit) {
        throw new AppException('MEMBER_LIMIT_REACHED', HttpStatus.CONFLICT);
      }

      const [created] = await tx
        .insert(workspaceInvitations)
        .values({
          workspaceId: session.workspace.id,
          invitedByUserId: session.user.id,
          emailNormalized: email,
          role: parsed.data.role,
          tokenHash: this.hash(token),
          deliveryStatus: 'pending',
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created)
        throw new AppException('REQUEST_FAILED', HttpStatus.CONFLICT);
      await Promise.all([
        tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'team.invitation_created',
          subjectType: 'workspace_invitation',
          subjectId: created.id,
          summary: 'Workspace invitation created',
          metadata: { role: created.role },
        }),
        tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          type: 'team.invitation_created',
          metadata: { email, role: created.role },
        }),
      ]);
      return created;
    });

    await this.deliverInvitation(invitation.id, email, token);
    const [delivered] = await this.database.db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, invitation.id))
      .limit(1);
    return this.serializeInvitation(
      delivered ?? invitation,
      session.user.displayName,
    );
  }

  async resendInvitation(
    session: PortalAuthSession,
    invitationId: string,
  ): Promise<PortalTeamInvitation> {
    this.requireManage(session);
    const now = new Date();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + invitationLifetimeMilliseconds);
    const invitation = await this.database.db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, session.workspace.id))
        .for('update')
        .limit(1);
      if (!workspace)
        throw new AppException(
          'AUTH_WORKSPACE_UNAVAILABLE',
          HttpStatus.NOT_FOUND,
        );
      const [actor] = await tx
        .select({ role: workspaceMemberships.role })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, session.user.id),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .limit(1);
      if (!actor || !managerRoles.has(actor.role))
        throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
      const [row] = await tx
        .select({ invitation: workspaceInvitations, inviter: users })
        .from(workspaceInvitations)
        .innerJoin(users, eq(workspaceInvitations.invitedByUserId, users.id))
        .where(
          and(
            eq(workspaceInvitations.id, invitationId),
            eq(workspaceInvitations.workspaceId, session.workspace.id),
          ),
        )
        .for('update')
        .limit(1);
      if (
        !row ||
        row.invitation.status !== 'pending' ||
        row.invitation.expiresAt <= now
      ) {
        throw new AppException(
          'INVITATION_RESEND_NOT_ALLOWED',
          HttpStatus.CONFLICT,
        );
      }
      if (row.invitation.role === 'admin' && actor.role !== 'owner') {
        throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.FORBIDDEN);
      }
      const [updated] = await tx
        .update(workspaceInvitations)
        .set({
          tokenHash: this.hash(token),
          deliveryStatus: 'pending',
          expiresAt,
          updatedAt: now,
        })
        .where(eq(workspaceInvitations.id, row.invitation.id))
        .returning();
      await Promise.all([
        tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'team.invitation_resent',
          subjectType: 'workspace_invitation',
          subjectId: row.invitation.id,
          summary: 'Workspace invitation resent',
          metadata: {},
        }),
        tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          type: 'team.invitation_resent',
          metadata: { email: row.invitation.emailNormalized },
        }),
      ]);
      if (!updated)
        throw new AppException('REQUEST_FAILED', HttpStatus.CONFLICT);
      return { invitation: updated, invitedByName: row.inviter.displayName };
    });

    await this.deliverInvitation(
      invitation.invitation.id,
      invitation.invitation.emailNormalized,
      token,
    );
    const [delivered] = await this.database.db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, invitation.invitation.id))
      .limit(1);
    return this.serializeInvitation(
      delivered ?? invitation.invitation,
      invitation.invitedByName,
    );
  }

  async revokeInvitation(
    session: PortalAuthSession,
    invitationId: string,
  ): Promise<void> {
    this.requireManage(session);
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, session.workspace.id))
        .for('update')
        .limit(1);
      if (!workspace)
        throw new AppException(
          'AUTH_WORKSPACE_UNAVAILABLE',
          HttpStatus.NOT_FOUND,
        );
      const [actor] = await tx
        .select({ role: workspaceMemberships.role })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, session.user.id),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .limit(1);
      if (!actor || !managerRoles.has(actor.role))
        throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
      const [invitation] = await tx
        .select()
        .from(workspaceInvitations)
        .where(
          and(
            eq(workspaceInvitations.id, invitationId),
            eq(workspaceInvitations.workspaceId, session.workspace.id),
          ),
        )
        .for('update')
        .limit(1);
      if (!invitation || invitation.status !== 'pending') return;
      const [revoked] = await tx
        .update(workspaceInvitations)
        .set({ status: 'revoked', updatedAt: now })
        .where(
          and(
            eq(workspaceInvitations.id, invitation.id),
            eq(workspaceInvitations.status, 'pending'),
          ),
        )
        .returning({ id: workspaceInvitations.id });
      if (!revoked) return;
      await Promise.all([
        tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'team.invitation_revoked',
          subjectType: 'workspace_invitation',
          subjectId: invitation.id,
          summary: 'Workspace invitation revoked',
          metadata: {},
        }),
        tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          type: 'team.invitation_revoked',
          metadata: { email: invitation.emailNormalized },
        }),
      ]);
    });
  }

  async acceptInvitation(session: PortalAuthSession, input: unknown) {
    const parsed = acceptPortalTeamInvitationSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const tokenHash = this.hash(parsed.data.token);
    const now = new Date();
    const [invitation] = await this.database.db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.tokenHash, tokenHash))
      .limit(1);
    if (!invitation || invitation.status !== 'pending')
      throw new AppException('INVITATION_ALREADY_USED', HttpStatus.CONFLICT);
    if (invitation.expiresAt <= now) {
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(workspaceInvitations)
          .set({ status: 'expired', updatedAt: now })
          .where(eq(workspaceInvitations.id, invitation.id));
        await tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: invitation.workspaceId,
          type: 'team.invitation_expired',
          metadata: { email: invitation.emailNormalized },
        });
      });
      throw new AppException('INVITATION_EXPIRED', HttpStatus.GONE);
    }
    if (
      invitation.emailNormalized !==
      session.user.email.toLocaleLowerCase('en-US')
    ) {
      throw new AppException('INVITATION_EMAIL_MISMATCH', HttpStatus.FORBIDDEN);
    }

    await this.database.db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: workspaces.id, memberLimit: workspaces.memberLimit })
        .from(workspaces)
        .where(eq(workspaces.id, invitation.workspaceId))
        .for('update')
        .limit(1);
      if (!workspace)
        throw new AppException(
          'AUTH_WORKSPACE_UNAVAILABLE',
          HttpStatus.NOT_FOUND,
        );
      const [activeRows] = await tx
        .select({ total: count() })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, invitation.workspaceId),
            eq(workspaceMemberships.status, 'active'),
          ),
        );
      if (
        workspace.memberLimit !== null &&
        Number(activeRows?.total ?? 0) >= workspace.memberLimit
      ) {
        throw new AppException('MEMBER_LIMIT_REACHED', HttpStatus.CONFLICT);
      }

      const [existing] = await tx
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, invitation.workspaceId),
            eq(workspaceMemberships.userId, session.user.id),
          ),
        )
        .limit(1);
      let membershipId: string;
      if (existing?.status === 'active')
        throw new AppException('INVITATION_ALREADY_USED', HttpStatus.CONFLICT);
      if (existing) {
        await tx
          .update(workspaceMemberships)
          .set({
            role: invitation.role,
            status: 'active',
            joinedAt: now,
            updatedAt: now,
          })
          .where(eq(workspaceMemberships.id, existing.id));
        membershipId = existing.id;
      } else {
        const [created] = await tx
          .insert(workspaceMemberships)
          .values({
            workspaceId: invitation.workspaceId,
            userId: session.user.id,
            role: invitation.role,
            status: 'active',
            joinedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: workspaceMemberships.id });
        if (!created)
          throw new AppException('REQUEST_FAILED', HttpStatus.CONFLICT);
        membershipId = created.id;
      }
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
            eq(workspaceInvitations.tokenHash, tokenHash),
          ),
        )
        .returning({ id: workspaceInvitations.id });
      if (!consumed)
        throw new AppException('INVITATION_ALREADY_USED', HttpStatus.CONFLICT);
      await tx
        .update(workspaces)
        .set({ kind: 'team', updatedAt: now })
        .where(eq(workspaces.id, invitation.workspaceId));
      await Promise.all([
        tx.insert(apiAuditLogs).values({
          workspaceId: invitation.workspaceId,
          actorUserId: session.user.id,
          event: 'team.invitation_accepted',
          subjectType: 'workspace_membership',
          subjectId: membershipId,
          summary: 'Workspace invitation accepted',
          metadata: {},
        }),
        tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: invitation.workspaceId,
          actorUserId: session.user.id,
          subjectUserId: session.user.id,
          type: 'team.invitation_accepted',
          metadata: {},
        }),
      ]);
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
    if (parsed.data.role === 'owner')
      throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.FORBIDDEN);
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, session.workspace.id))
        .for('update')
        .limit(1);
      if (!workspace)
        throw new AppException(
          'AUTH_WORKSPACE_UNAVAILABLE',
          HttpStatus.NOT_FOUND,
        );
      const [actor] = await tx
        .select({ role: workspaceMemberships.role })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, session.user.id),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .limit(1);
      const [member] = await tx
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
      if (actor?.role !== 'owner' || !member || member.role === 'owner')
        throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.FORBIDDEN);
      await tx
        .update(workspaceMemberships)
        .set({ role: parsed.data.role, updatedAt: now })
        .where(eq(workspaceMemberships.id, member.id));
      if (parsed.data.role === 'admin') {
        await tx
          .delete(socialAccountMemberships)
          .where(eq(socialAccountMemberships.workspaceMembershipId, member.id));
      }
      await Promise.all([
        tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'team.member_role_updated',
          subjectType: 'workspace_membership',
          subjectId: member.id,
          summary: 'Workspace member role updated',
          metadata: { role: parsed.data.role },
        }),
        tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          subjectUserId: userId,
          type: 'team.member_role_updated',
          metadata: { role: parsed.data.role },
        }),
      ]);
    });
    return { id: userId, role: parsed.data.role };
  }

  async updateMemberAccess(
    session: PortalAuthSession,
    userId: string,
    input: unknown,
  ) {
    this.requireManage(session);
    const parsed = updatePortalTeamMemberAccessSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const accountIds = [...new Set(parsed.data.accountIds)];
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, session.workspace.id))
        .for('update')
        .limit(1);
      if (!workspace)
        throw new AppException(
          'AUTH_WORKSPACE_UNAVAILABLE',
          HttpStatus.NOT_FOUND,
        );
      const [actor] = await tx
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, session.user.id),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .limit(1);
      const [member] = await tx
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
      if (
        !actor ||
        !managerRoles.has(actor.role) ||
        !member ||
        member.role === 'owner' ||
        userId === session.user.id
      ) {
        throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
      }
      if (
        actor.role === 'admin' &&
        (member.role !== 'member' || parsed.data.role !== 'member')
      ) {
        throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.FORBIDDEN);
      }
      if (parsed.data.role === 'admin' && actor.role !== 'owner')
        throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.FORBIDDEN);
      if (parsed.data.role === 'member' && accountIds.length) {
        const accounts = await tx
          .select({ id: socialAccounts.id })
          .from(socialAccounts)
          .where(
            and(
              eq(socialAccounts.workspaceId, session.workspace.id),
              eq(socialAccounts.status, 'active'),
              isNull(socialAccounts.disconnectedAt),
              inArray(socialAccounts.id, accountIds),
            ),
          );
        if (accounts.length !== accountIds.length)
          throw new AppException(
            'ACCOUNT_GRANT_NOT_ALLOWED',
            HttpStatus.FORBIDDEN,
          );
      }
      await tx
        .update(workspaceMemberships)
        .set({ role: parsed.data.role, updatedAt: now })
        .where(eq(workspaceMemberships.id, member.id));
      await tx
        .delete(socialAccountMemberships)
        .where(eq(socialAccountMemberships.workspaceMembershipId, member.id));
      if (parsed.data.role === 'member' && accountIds.length) {
        await tx.insert(socialAccountMemberships).values(
          accountIds.map((socialAccountId) => ({
            socialAccountId,
            workspaceMembershipId: member.id,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
      await Promise.all([
        tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'team.member_access_updated',
          subjectType: 'workspace_membership',
          subjectId: member.id,
          summary: 'Workspace member access updated',
          metadata: {
            role: parsed.data.role,
            accountCount:
              parsed.data.role === 'member' ? accountIds.length : null,
          },
        }),
        tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          subjectUserId: userId,
          type: 'team.member_access_updated',
          metadata: {
            role: parsed.data.role,
            accountCount:
              parsed.data.role === 'member' ? accountIds.length : null,
          },
        }),
      ]);
    });
    return {
      id: userId,
      role: parsed.data.role,
      accountIds: parsed.data.role === 'member' ? accountIds : [],
    };
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
    const uniqueIds = [...new Set(parsed.data.accountIds)];
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, session.workspace.id))
        .for('update')
        .limit(1);
      if (!workspace)
        throw new AppException(
          'AUTH_WORKSPACE_UNAVAILABLE',
          HttpStatus.NOT_FOUND,
        );
      const [actor] = await tx
        .select({ role: workspaceMemberships.role })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, session.user.id),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .limit(1);
      const [member] = await tx
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
      if (
        !actor ||
        !managerRoles.has(actor.role) ||
        !member ||
        member.role !== 'member'
      ) {
        throw new AppException(
          'ACCOUNT_GRANT_NOT_ALLOWED',
          HttpStatus.FORBIDDEN,
        );
      }
      const accounts = uniqueIds.length
        ? await tx
            .select({ id: socialAccounts.id })
            .from(socialAccounts)
            .where(
              and(
                eq(socialAccounts.workspaceId, session.workspace.id),
                eq(socialAccounts.status, 'active'),
                isNull(socialAccounts.disconnectedAt),
                inArray(socialAccounts.id, uniqueIds),
              ),
            )
        : [];
      if (accounts.length !== uniqueIds.length)
        throw new AppException(
          'ACCOUNT_GRANT_NOT_ALLOWED',
          HttpStatus.FORBIDDEN,
        );
      await tx
        .delete(socialAccountMemberships)
        .where(eq(socialAccountMemberships.workspaceMembershipId, member.id));
      if (uniqueIds.length) {
        await tx.insert(socialAccountMemberships).values(
          uniqueIds.map((socialAccountId) => ({
            socialAccountId,
            workspaceMembershipId: member.id,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
      await Promise.all([
        tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'team.member_account_grants_replaced',
          subjectType: 'workspace_membership',
          subjectId: member.id,
          summary: 'Workspace member account grants replaced',
          metadata: { count: uniqueIds.length },
        }),
        tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          subjectUserId: userId,
          type: 'team.member_account_grants_replaced',
          metadata: { count: uniqueIds.length },
        }),
      ]);
    });
    return { accountIds: uniqueIds, userId };
  }

  async removeMember(
    session: PortalAuthSession,
    userId: string,
  ): Promise<void> {
    this.requireManage(session);
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, session.workspace.id))
        .for('update')
        .limit(1);
      if (!workspace)
        throw new AppException(
          'AUTH_WORKSPACE_UNAVAILABLE',
          HttpStatus.NOT_FOUND,
        );
      const [actor] = await tx
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, session.user.id),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .limit(1);
      const [member] = await tx
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
      if (
        !actor ||
        !managerRoles.has(actor.role) ||
        !member ||
        member.role === 'owner' ||
        userId === session.user.id ||
        (actor.role === 'admin' && member.role !== 'member')
      ) {
        throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
      }
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
      await Promise.all([
        tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'team.member_revoked',
          subjectType: 'workspace_membership',
          subjectId: member.id,
          summary: 'Workspace member revoked',
          metadata: {},
        }),
        tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          subjectUserId: userId,
          type: 'team.member_revoked',
          metadata: {},
        }),
      ]);
    });
  }

  async leaveWorkspace(session: PortalAuthSession) {
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, session.workspace.id))
        .for('update')
        .limit(1);
      if (!workspace)
        throw new AppException(
          'AUTH_WORKSPACE_UNAVAILABLE',
          HttpStatus.NOT_FOUND,
        );
      const [membership] = await tx
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, session.user.id),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .limit(1);
      if (!membership)
        throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
      if (membership.role === 'owner')
        throw new AppException('LAST_OWNER_PROTECTED', HttpStatus.CONFLICT);
      await tx
        .delete(socialAccountMemberships)
        .where(
          eq(socialAccountMemberships.workspaceMembershipId, membership.id),
        );
      await tx
        .update(workspaceMemberships)
        .set({ status: 'revoked', updatedAt: now })
        .where(eq(workspaceMemberships.id, membership.id));
      await tx
        .update(authSessions)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(authSessions.userId, session.user.id),
            eq(authSessions.activeWorkspaceId, session.workspace.id),
          ),
        );
      await Promise.all([
        tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'team.member_left',
          subjectType: 'workspace_membership',
          subjectId: membership.id,
          summary: 'Workspace member left',
          metadata: {},
        }),
        tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          subjectUserId: session.user.id,
          type: 'team.member_left',
          metadata: {},
        }),
      ]);
    });
    return { left: true as const };
  }

  async transferOwnership(session: PortalAuthSession, input: unknown) {
    if (session.workspace.role !== 'owner')
      throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
    const parsed = transferPortalTeamOwnershipSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    if (parsed.data.targetUserId === session.user.id)
      throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.CONFLICT);
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ id: workspaces.id, ownerUserId: workspaces.ownerUserId })
        .from(workspaces)
        .where(eq(workspaces.id, session.workspace.id))
        .for('update')
        .limit(1);
      if (!workspace || workspace.ownerUserId !== session.user.id)
        throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
      const [target] = await tx
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, parsed.data.targetUserId),
            eq(workspaceMemberships.status, 'active'),
            eq(workspaceMemberships.role, 'admin'),
          ),
        )
        .limit(1);
      const [actor] = await tx
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, session.user.id),
            eq(workspaceMemberships.status, 'active'),
            eq(workspaceMemberships.role, 'owner'),
          ),
        )
        .limit(1);
      if (!target || !actor)
        throw new AppException('ROLE_CHANGE_NOT_ALLOWED', HttpStatus.CONFLICT);
      await tx
        .update(workspaces)
        .set({
          kind: 'team',
          ownerUserId: target.userId,
          updatedAt: now,
        })
        .where(eq(workspaces.id, workspace.id));
      await tx
        .update(workspaceMemberships)
        .set({ role: 'admin', updatedAt: now })
        .where(eq(workspaceMemberships.id, actor.id));
      await tx
        .update(workspaceMemberships)
        .set({ role: 'owner', updatedAt: now })
        .where(eq(workspaceMemberships.id, target.id));
      await Promise.all([
        tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'team.ownership_transferred',
          subjectType: 'workspace_membership',
          subjectId: target.id,
          summary: 'Workspace ownership transferred',
          metadata: {},
        }),
        tx.insert(workspaceMembershipAuditEvents).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          subjectUserId: target.userId,
          type: 'team.ownership_transferred',
          metadata: {},
        }),
      ]);
    });
    return { ownerUserId: parsed.data.targetUserId };
  }

  async listActivity(
    session: PortalAuthSession,
    query: unknown,
  ): Promise<PortalTeamActivityResponse> {
    this.requireManage(session);
    const parsed = portalTeamActivityQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    const filters = parsed.data;
    const categoryTypes =
      filters.category === 'all'
        ? [...activityTypes]
        : activityTypesByCategory[filters.category];
    const search = filters.q ? `%${filters.q}%` : null;
    const where = and(
      eq(workspaceMembershipAuditEvents.workspaceId, session.workspace.id),
      inArray(workspaceMembershipAuditEvents.type, categoryTypes),
      search
        ? sql`(
            ${workspaceMembershipAuditEvents.type} ilike ${search}
            or ${workspaceMembershipAuditEvents.metadata}->>'email' ilike ${search}
            or exists (
              select 1 from ${users} actor
              where actor.id = ${workspaceMembershipAuditEvents.actorUserId}
                and actor.display_name ilike ${search}
            )
            or exists (
              select 1 from ${users} subject
              where subject.id = ${workspaceMembershipAuditEvents.subjectUserId}
                and subject.display_name ilike ${search}
            )
          )`
        : undefined,
    );
    const [events, totals] = await Promise.all([
      this.database.db
        .select()
        .from(workspaceMembershipAuditEvents)
        .where(where)
        .orderBy(desc(workspaceMembershipAuditEvents.createdAt))
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit),
      this.database.db
        .select({ total: count() })
        .from(workspaceMembershipAuditEvents)
        .where(where),
    ]);
    const userIds = [
      ...new Set(
        events.flatMap((event) =>
          [event.actorUserId, event.subjectUserId].filter(
            (id): id is string => id !== null,
          ),
        ),
      ),
    ];
    const people = userIds.length
      ? await this.database.db
          .select({ id: users.id, name: users.displayName })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const names = new Map(people.map((person) => [person.id, person.name]));

    return {
      events: events.flatMap((event) => {
        if (!activityTypes.has(event.type as PortalTeamActivityEventType)) {
          return [];
        }
        return [
          {
            id: event.id,
            actorName: event.actorUserId
              ? (names.get(event.actorUserId) ?? null)
              : null,
            subjectName: event.subjectUserId
              ? (names.get(event.subjectUserId) ?? null)
              : this.metadataString(event.metadata, 'email'),
            type: event.type as PortalTeamActivityEventType,
            createdAt: event.createdAt.toISOString(),
          },
        ];
      }),
      page: filters.page,
      limit: filters.limit,
      total: Number(totals[0]?.total ?? 0),
    };
  }

  private async deliverInvitation(
    invitationId: string,
    email: string,
    token: string,
  ) {
    const tokenHash = this.hash(token);
    try {
      await this.email.sendTeamInvitation(email, token);
      const now = new Date();
      await this.database.db
        .update(workspaceInvitations)
        .set({ deliveryStatus: 'sent', lastSentAt: now, updatedAt: now })
        .where(
          and(
            eq(workspaceInvitations.id, invitationId),
            eq(workspaceInvitations.status, 'pending'),
            eq(workspaceInvitations.tokenHash, tokenHash),
          ),
        );
    } catch (error) {
      await this.database.db
        .update(workspaceInvitations)
        .set({ deliveryStatus: 'failed', updatedAt: new Date() })
        .where(
          and(
            eq(workspaceInvitations.id, invitationId),
            eq(workspaceInvitations.status, 'pending'),
            eq(workspaceInvitations.tokenHash, tokenHash),
          ),
        );
      throw error;
    }
  }

  private async expirePendingInvitations(workspaceId: string) {
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      const expired = await tx
        .update(workspaceInvitations)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            eq(workspaceInvitations.workspaceId, workspaceId),
            eq(workspaceInvitations.status, 'pending'),
            lte(workspaceInvitations.expiresAt, now),
          ),
        )
        .returning({ email: workspaceInvitations.emailNormalized });
      if (expired.length) {
        await tx.insert(workspaceMembershipAuditEvents).values(
          expired.map(({ email }) => ({
            workspaceId,
            type: 'team.invitation_expired',
            metadata: { email },
          })),
        );
      }
    });
  }

  private serializeInvitation(
    invitation: typeof workspaceInvitations.$inferSelect,
    invitedByName: string,
  ): PortalTeamInvitation {
    return {
      id: invitation.id,
      email: invitation.emailNormalized,
      role: invitation.role as 'admin' | 'member',
      invitedByName,
      createdAt: invitation.createdAt.toISOString(),
      lastSentAt: invitation.lastSentAt?.toISOString() ?? null,
      expiresAt: invitation.expiresAt.toISOString(),
      deliveryStatus: invitation.deliveryStatus as
        'pending' | 'sent' | 'failed',
    };
  }

  private metadataString(
    metadata: Record<string, unknown>,
    key: string,
  ): string | null {
    return typeof metadata[key] === 'string' ? metadata[key] : null;
  }

  private requireManage(session: PortalAuthSession) {
    if (!managerRoles.has(session.workspace.role))
      throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
