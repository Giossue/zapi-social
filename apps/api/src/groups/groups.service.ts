import { HttpStatus, Injectable } from '@nestjs/common';
import {
  accountGroups,
  accountGroupSocialAccounts,
  apiAuditLogs,
  socialAccountMemberships,
  socialAccounts,
  workspaceMemberships,
} from '@workspace/database';
import { and, desc, eq, ilike, inArray, or } from '@workspace/database/query';
import {
  createPortalAccountGroupSchema,
  portalGroupsQuerySchema,
  updatePortalAccountGroupSchema,
  workspacePermissionMatches,
  type PortalAccountGroup,
  type PortalAuthSession,
  type PortalGroupsResponse,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const managerRoles = new Set(['owner', 'admin']);

@Injectable()
export class GroupsService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    session: PortalAuthSession,
    query: unknown,
  ): Promise<PortalGroupsResponse> {
    const parsed = portalGroupsQuerySchema.safeParse(query);
    if (!parsed.success) throw this.validationError();

    const groupFilters = [eq(accountGroups.workspaceId, session.workspace.id)];
    if (parsed.data.status) {
      groupFilters.push(eq(accountGroups.status, parsed.data.status));
    }
    if (parsed.data.q) {
      const value = `%${parsed.data.q}%`;
      groupFilters.push(
        or(
          ilike(accountGroups.name, value),
          ilike(accountGroups.description, value),
          ilike(accountGroups.slug, value),
        )!,
      );
    }

    const [groups, allGroups, accounts] = await Promise.all([
      this.database.db
        .select()
        .from(accountGroups)
        .where(and(...groupFilters))
        .orderBy(desc(accountGroups.updatedAt), desc(accountGroups.id)),
      this.database.db
        .select()
        .from(accountGroups)
        .where(eq(accountGroups.workspaceId, session.workspace.id)),
      this.accessibleAccounts(session),
    ]);
    const visibleAccountIds = new Set(accounts.map((account) => account.id));
    const groupIds = groups.map((group) => group.id);
    const allGroupIds = allGroups.map((group) => group.id);
    const memberships = groupIds.length
      ? await this.database.db
          .select()
          .from(accountGroupSocialAccounts)
          .where(inArray(accountGroupSocialAccounts.groupId, groupIds))
      : [];
    const allMemberships = allGroupIds.length
      ? await this.database.db
          .select()
          .from(accountGroupSocialAccounts)
          .where(inArray(accountGroupSocialAccounts.groupId, allGroupIds))
      : [];
    const accountIdsByGroup = new Map<string, string[]>();
    for (const membership of memberships) {
      if (!visibleAccountIds.has(membership.socialAccountId)) continue;
      const ids = accountIdsByGroup.get(membership.groupId) ?? [];
      ids.push(membership.socialAccountId);
      accountIdsByGroup.set(membership.groupId, ids);
    }
    const visibleGroupIds = new Set(
      allMemberships
        .filter((membership) =>
          visibleAccountIds.has(membership.socialAccountId),
        )
        .map((membership) => membership.groupId),
    );
    const visibleGroups = managerRoles.has(session.workspace.role)
      ? groups
      : groups.filter((group) => visibleGroupIds.has(group.id));
    const visibleAllGroups = managerRoles.has(session.workspace.role)
      ? allGroups
      : allGroups.filter((group) => visibleGroupIds.has(group.id));

    return {
      canManage:
        managerRoles.has(session.workspace.role) ||
        workspacePermissionMatches(
          session.workspace.permissions,
          'groups.manage',
        ),
      accounts: accounts.map((account) => ({
        id: account.id,
        displayName: account.displayName,
        providerKey: account.providerKey,
        capabilityKey: account.capabilityKey,
        avatarUrl: account.avatarUrl,
      })),
      groups: visibleGroups.map((group) =>
        this.toGroup(group, accountIdsByGroup.get(group.id) ?? []),
      ),
      metrics: {
        total: visibleAllGroups.length,
        active: visibleAllGroups.filter((group) => group.status === 'active')
          .length,
        inactive: visibleAllGroups.filter(
          (group) => group.status === 'inactive',
        ).length,
        reachedAccounts: new Set(
          allMemberships
            .map((membership) => membership.socialAccountId)
            .filter((id) => visibleAccountIds.has(id)),
        ).size,
      },
    };
  }

  async create(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalAccountGroup> {
    this.requireManage(session);
    const parsed = createPortalAccountGroupSchema.safeParse(input);
    if (!parsed.success) throw this.validationError();
    await this.requireAccounts(session, parsed.data.accountIds);
    const now = new Date();
    const slug = await this.uniqueSlug(session.workspace.id, parsed.data.name);
    const group = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(accountGroups)
        .values({
          workspaceId: session.workspace.id,
          createdByUserId: session.user.id,
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          color: parsed.data.color,
          status: parsed.data.status,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw this.conflict();
      if (parsed.data.accountIds.length) {
        await tx.insert(accountGroupSocialAccounts).values(
          parsed.data.accountIds.map((socialAccountId) => ({
            groupId: created.id,
            workspaceId: session.workspace.id,
            socialAccountId,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'group.created',
        subjectType: 'account_group',
        subjectId: created.id,
        metadata: { accountCount: parsed.data.accountIds.length },
      });
      return created;
    });
    return this.toGroup(group, parsed.data.accountIds);
  }

  async update(
    session: PortalAuthSession,
    id: string,
    input: unknown,
  ): Promise<PortalAccountGroup> {
    this.requireManage(session);
    const groupId = this.parseId(id);
    const parsed = updatePortalAccountGroupSchema.safeParse(input);
    if (!parsed.success) throw this.validationError();
    const existing = await this.findForSession(session, groupId);
    if (parsed.data.accountIds) {
      await this.requireAccounts(session, parsed.data.accountIds);
    }
    const slug = parsed.data.name
      ? await this.uniqueSlug(session.workspace.id, parsed.data.name, groupId)
      : existing.slug;
    const now = new Date();
    const group = await this.database.db.transaction(async (tx) => {
      const { accountIds, ...changes } = parsed.data;
      const [updated] = await tx
        .update(accountGroups)
        .set({ ...changes, slug, updatedAt: now })
        .where(
          and(
            eq(accountGroups.id, groupId),
            eq(accountGroups.workspaceId, session.workspace.id),
          ),
        )
        .returning();
      if (!updated) throw this.notFound();
      if (accountIds) {
        await tx
          .delete(accountGroupSocialAccounts)
          .where(eq(accountGroupSocialAccounts.groupId, groupId));
        if (accountIds.length) {
          await tx.insert(accountGroupSocialAccounts).values(
            accountIds.map((socialAccountId) => ({
              groupId,
              workspaceId: session.workspace.id,
              socialAccountId,
              createdAt: now,
              updatedAt: now,
            })),
          );
        }
      }
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'group.updated',
        subjectType: 'account_group',
        subjectId: groupId,
        metadata: { changedFields: Object.keys(parsed.data) },
      });
      return updated;
    });
    const memberships = await this.database.db
      .select({ id: accountGroupSocialAccounts.socialAccountId })
      .from(accountGroupSocialAccounts)
      .where(eq(accountGroupSocialAccounts.groupId, groupId));
    return this.toGroup(
      group,
      memberships.map(({ id: accountId }) => accountId),
    );
  }

  async remove(session: PortalAuthSession, id: string): Promise<void> {
    this.requireManage(session);
    const groupId = this.parseId(id);
    await this.findForSession(session, groupId);
    await this.database.db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(accountGroups)
        .where(
          and(
            eq(accountGroups.id, groupId),
            eq(accountGroups.workspaceId, session.workspace.id),
          ),
        )
        .returning({ id: accountGroups.id });
      if (!removed) throw this.notFound();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'group.deleted',
        subjectType: 'account_group',
        subjectId: groupId,
        metadata: {},
      });
    });
  }

  private async accessibleAccounts(session: PortalAuthSession) {
    const filters = [
      eq(socialAccounts.workspaceId, session.workspace.id),
      eq(socialAccounts.status, 'active'),
    ];
    if (!managerRoles.has(session.workspace.role)) {
      const [membership] = await this.database.db
        .select({ id: workspaceMemberships.id })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, session.workspace.id),
            eq(workspaceMemberships.userId, session.user.id),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .limit(1);
      if (!membership) return [];
      const grants = await this.database.db
        .select({ id: socialAccountMemberships.socialAccountId })
        .from(socialAccountMemberships)
        .where(
          eq(socialAccountMemberships.workspaceMembershipId, membership.id),
        );
      const grantedIds = grants.map(({ id }) => id);
      if (!grantedIds.length) return [];
      filters.push(inArray(socialAccounts.id, grantedIds));
    }
    return this.database.db
      .select()
      .from(socialAccounts)
      .where(and(...filters))
      .orderBy(socialAccounts.displayName);
  }

  private async requireAccounts(session: PortalAuthSession, ids: string[]) {
    if (!ids.length) {
      if (managerRoles.has(session.workspace.role)) return;
      throw new AppException(
        'GROUP_ACCOUNT_NOT_AVAILABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const rows = await this.database.db
      .select({ id: socialAccounts.id })
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.workspaceId, session.workspace.id),
          eq(socialAccounts.status, 'active'),
          inArray(socialAccounts.id, ids),
        ),
      );
    const accessibleIds = new Set(
      (await this.accessibleAccounts(session)).map(({ id }) => id),
    );
    if (
      rows.length !== ids.length ||
      rows.some(({ id }) => !accessibleIds.has(id))
    ) {
      throw new AppException(
        'GROUP_ACCOUNT_NOT_AVAILABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async findForSession(session: PortalAuthSession, id: string) {
    const group = await this.find(session.workspace.id, id);
    if (managerRoles.has(session.workspace.role)) return group;
    const [memberships, accounts] = await Promise.all([
      this.database.db
        .select({ id: accountGroupSocialAccounts.socialAccountId })
        .from(accountGroupSocialAccounts)
        .where(eq(accountGroupSocialAccounts.groupId, id)),
      this.accessibleAccounts(session),
    ]);
    const accessibleIds = new Set(accounts.map((account) => account.id));
    if (
      !memberships.length ||
      memberships.some(({ id: accountId }) => !accessibleIds.has(accountId))
    )
      throw this.notFound();
    return group;
  }

  private async find(workspaceId: string, id: string) {
    const [group] = await this.database.db
      .select()
      .from(accountGroups)
      .where(
        and(
          eq(accountGroups.id, id),
          eq(accountGroups.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!group) throw this.notFound();
    return group;
  }

  private async uniqueSlug(
    workspaceId: string,
    name: string,
    ignoreId?: string,
  ) {
    const base = this.slugify(name) || 'group';
    let slug = base;
    let suffix = 2;
    while (true) {
      const [existing] = await this.database.db
        .select({ id: accountGroups.id })
        .from(accountGroups)
        .where(
          and(
            eq(accountGroups.workspaceId, workspaceId),
            eq(accountGroups.slug, slug),
          ),
        )
        .limit(1);
      if (!existing || existing.id === ignoreId) return slug;
      slug = `${base}-${suffix++}`.slice(0, 140);
    }
  }

  private slugify(value: string) {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 140);
  }

  private toGroup(
    group: typeof accountGroups.$inferSelect,
    accountIds: string[],
  ): PortalAccountGroup {
    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      color: group.color,
      status: group.status,
      accountIds,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  private requireManage(session: PortalAuthSession) {
    if (
      !managerRoles.has(session.workspace.role) &&
      !workspacePermissionMatches(
        session.workspace.permissions,
        'groups.manage',
      )
    ) {
      throw new AppException('GROUP_MANAGE_FORBIDDEN', HttpStatus.FORBIDDEN);
    }
  }

  private parseId(value: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      throw this.notFound();
    }
    return value;
  }

  private validationError() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }

  private notFound() {
    return new AppException('GROUP_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  private conflict() {
    return new AppException('GROUP_CREATE_FAILED', HttpStatus.CONFLICT);
  }
}
