import { HttpStatus, Injectable } from '@nestjs/common';
import {
  adminPermissionFor,
  adminPermissionMatches,
  portalModuleForPath,
  type PlatformAdminAuthSession,
  type PortalAuthSession,
} from '@workspace/contracts';
import { adminRoles, users } from '@workspace/database';
import { eq } from '@workspace/database/query';
import type { FastifyRequest } from 'fastify';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { IdentityService } from './identity.service';
import { PlanAccessService } from '../plans/plan-access.service';

const sessionCookieName = 'zapi_session';

@Injectable()
export class SessionAccessService {
  constructor(
    private readonly identity: IdentityService,
    private readonly database: DatabaseService,
    private readonly planAccess: PlanAccessService,
  ) {}

  async requirePlatformAdmin(
    request: FastifyRequest,
  ): Promise<PlatformAdminAuthSession> {
    const session = await this.requireSession(request);
    if (session.area !== 'admin') {
      throw new AppException(
        'AUTH_ADMIN_ACCESS_REQUIRED',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.requireAdminPermission(session.user.id, request);
    return session;
  }

  async requirePortalSession(
    request: FastifyRequest,
  ): Promise<PortalAuthSession> {
    const session = await this.requireSession(request);
    if (session.area !== 'portal') {
      throw new AppException(
        'AUTH_PORTAL_ACCESS_REQUIRED',
        HttpStatus.FORBIDDEN,
      );
    }
    const module = portalModuleForPath(request.url);
    if (module) {
      await this.planAccess.requireModule(session.workspace.id, module);
    }
    return session;
  }

  private async requireAdminPermission(
    userId: string,
    request: FastifyRequest,
  ) {
    const required = adminPermissionFor(request.url, request.method);
    if (!required) return;
    const [row] = await this.database.db
      .select({
        isPlatformAdmin: users.isPlatformAdmin,
        permissions: adminRoles.permissions,
      })
      .from(users)
      .leftJoin(adminRoles, eq(adminRoles.id, users.adminRoleId))
      .where(eq(users.id, userId))
      .limit(1);
    if (row?.isPlatformAdmin) return;
    if (
      !row?.permissions ||
      !adminPermissionMatches(row.permissions, required)
    ) {
      throw new AppException(
        'AUTH_ADMIN_PERMISSION_REQUIRED',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async requireSession(request: FastifyRequest) {
    const session = await this.identity.getSession(
      request.cookies[sessionCookieName],
    );
    if (!session) {
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);
    }
    return session;
  }
}
