import { Injectable } from '@nestjs/common';
import {
  socialAccountMemberships,
  socialAccounts,
  workspaceMemberships,
} from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import type { PortalAuthSession } from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';

const unrestrictedRoles = new Set(['owner', 'admin']);

export type TeamAccountAccessScope =
  | { unrestricted: true; accountIds: ReadonlySet<string> }
  | { unrestricted: false; accountIds: ReadonlySet<string> };

@Injectable()
export class TeamAccountAccessService {
  constructor(private readonly database: DatabaseService) {}

  async resolve(session: PortalAuthSession): Promise<TeamAccountAccessScope> {
    if (unrestrictedRoles.has(session.workspace.role)) {
      return { unrestricted: true, accountIds: new Set() };
    }

    const grants = await this.database.db
      .select({ socialAccountId: socialAccountMemberships.socialAccountId })
      .from(socialAccountMemberships)
      .innerJoin(
        workspaceMemberships,
        eq(
          socialAccountMemberships.workspaceMembershipId,
          workspaceMemberships.id,
        ),
      )
      .innerJoin(
        socialAccounts,
        eq(socialAccountMemberships.socialAccountId, socialAccounts.id),
      )
      .where(
        and(
          eq(workspaceMemberships.workspaceId, session.workspace.id),
          eq(workspaceMemberships.userId, session.user.id),
          eq(workspaceMemberships.status, 'active'),
          eq(socialAccounts.workspaceId, session.workspace.id),
        ),
      );

    return {
      unrestricted: false,
      accountIds: new Set(grants.map(({ socialAccountId }) => socialAccountId)),
    };
  }

  allows(scope: TeamAccountAccessScope, accountId: string): boolean {
    return scope.unrestricted || scope.accountIds.has(accountId);
  }

  allowsAll(scope: TeamAccountAccessScope, accountIds: string[]): boolean {
    return (
      scope.unrestricted || accountIds.every((id) => scope.accountIds.has(id))
    );
  }

  filter(scope: TeamAccountAccessScope, accountIds: string[]): string[] {
    return scope.unrestricted
      ? accountIds
      : accountIds.filter((id) => scope.accountIds.has(id));
  }
}
