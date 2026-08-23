import { HttpStatus, Injectable } from '@nestjs/common';
import { workspaceMemberships } from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import {
  type PortalAuthSession,
  type WorkspacePermission,
  workspacePermissionCatalog,
  workspacePermissionSchema,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

/** Roles que tienen todos los permisos sin que nadie se los conceda. */
const unrestrictedRoles = new Set(['owner', 'admin']);

export const allWorkspacePermissions: readonly WorkspacePermission[] =
  workspacePermissionCatalog.flatMap((group) => [...group.permissions]);

@Injectable()
export class WorkspacePermissionsService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Descarta lo que no esté en el catálogo vigente y quita duplicados. Un
   * permiso retirado del catálogo deja de contar sin necesidad de migrar las
   * filas que aún lo guarden.
   */
  sanitize(values: readonly unknown[]): WorkspacePermission[] {
    const parsed = values.flatMap((value) => {
      const result = workspacePermissionSchema.safeParse(value);
      return result.success ? [result.data] : [];
    });
    return [...new Set(parsed)];
  }

  /** Lo que la interfaz debe pintar para una membresía concreta. */
  effective(
    role: string,
    granted: readonly unknown[],
  ): readonly WorkspacePermission[] {
    return unrestrictedRoles.has(role)
      ? allWorkspacePermissions
      : this.sanitize(granted);
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

  /**
   * La comprobación vive aquí y no en la interfaz: esconder un botón no es
   * autorizar. Ver `docs/reglas/seguridad.md`.
   */
  async require(
    session: PortalAuthSession,
    permission: WorkspacePermission,
  ): Promise<void> {
    if (await this.allows(session, permission)) return;
    throw new AppException('WORKSPACE_PERMISSION_DENIED', HttpStatus.FORBIDDEN);
  }
}
