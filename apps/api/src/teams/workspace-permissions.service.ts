import { HttpStatus, Injectable } from '@nestjs/common';
import { workspaceMemberships } from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import {
  allWorkspacePermissions,
  effectiveWorkspacePermissions,
  sanitizeWorkspacePermissions,
  type PortalAuthSession,
  type WorkspacePermission,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const unrestrictedRoles = new Set(['owner', 'admin']);

export { allWorkspacePermissions };

@Injectable()
export class WorkspacePermissionsService {
  constructor(private readonly database: DatabaseService) {}

  sanitize(values: readonly unknown[]): WorkspacePermission[] {
    return sanitizeWorkspacePermissions(values);
  }

  effective(
    role: string,
    granted: readonly unknown[],
  ): readonly WorkspacePermission[] {
    return effectiveWorkspacePermissions(role, granted);
  }

  async allows(
    session: PortalAuthSession,
    permission: WorkspacePermission,
  ): Promise<boolean> {
    if (unrestrictedRoles.has(session.workspace.role)) return true;

    const [membership] = await this.database.db
      .select({ permissions: workspaceMemberships.permissions })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, session.workspace.id),
          eq(workspaceMemberships.userId, session.user.id),
          eq(workspaceMemberships.status, 'active'),
        ),
      )
      .limit(1);

    return membership
      ? this.sanitize(membership.permissions).includes(permission)
      : false;
  }

  async require(
    session: PortalAuthSession,
    permission: WorkspacePermission,
  ): Promise<void> {
    if (await this.allows(session, permission)) return;
    throw new AppException('WORKSPACE_PERMISSION_DENIED', HttpStatus.FORBIDDEN);
  }
}
