import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  authSessions,
  users,
  workspaceMemberships,
  workspaces,
} from '@workspace/database';
import {
  loginSchema,
  registerSchema,
  type AuthSession,
  type PlatformAdminAuthSession,
  type PortalAuthSession,
} from '@workspace/contracts';
import { and, eq, gt, isNull, sql } from '@workspace/database/query';
import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const sessionLifetimeSeconds = 60 * 60 * 24 * 30;

@Injectable()
export class IdentityService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: unknown) {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException(
        'AUTH_PASSWORD_POLICY_NOT_MET',
        HttpStatus.BAD_REQUEST,
      );
    }
    const data = parsed.data;
    const email = data.email.toLowerCase();
    const passwordHash = await argon2.hash(data.password);
    const sessionToken = this.createSessionToken();

    const session = await this.database.db.transaction(async (tx) => {
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(sql`lower(${users.email})`, email))
        .limit(1);

      if (existingUser) {
        throw new AppException(
          'AUTH_EMAIL_ALREADY_REGISTERED',
          HttpStatus.CONFLICT,
        );
      }

      const [user] = await tx
        .insert(users)
        .values({
          email,
          displayName: data.displayName,
          passwordHash,
          isPlatformAdmin: false,
        })
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
        });

      const [workspace] = await tx
        .insert(workspaces)
        .values({
          ownerUserId: user.id,
          name: `${data.displayName} workspace`,
          slug: this.personalWorkspaceSlug(data.displayName),
        })
        .returning({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
        });

      await tx.insert(workspaceMemberships).values({
        workspaceId: workspace.id,
        userId: user.id,
        role: 'owner',
      });

      await tx.insert(authSessions).values({
        userId: user.id,
        activeWorkspaceId: workspace.id,
        tokenHash: this.hashSessionToken(sessionToken),
        expiresAt: this.sessionExpiry(),
      });

      return {
        user,
        area: 'portal' as const,
        workspace: { ...workspace, role: 'owner' },
      };
    });

    return this.buildAuthentication(session, sessionToken);
  }

  async login(input: unknown) {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException(
        'AUTH_INVALID_CREDENTIALS',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const data = parsed.data;
    const email = data.email.toLowerCase();
    const [user] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        passwordHash: users.passwordHash,
        status: users.status,
        isPlatformAdmin: users.isPlatformAdmin,
      })
      .from(users)
      .where(eq(sql`lower(${users.email})`, email))
      .limit(1);

    if (!user || user.status !== 'active' || !user.passwordHash) {
      throw new AppException(
        'AUTH_INVALID_CREDENTIALS',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const validPassword = await argon2.verify(user.passwordHash, data.password);
    if (!validPassword) {
      throw new AppException(
        'AUTH_INVALID_CREDENTIALS',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const userSession = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
    const session: AuthSession = user.isPlatformAdmin
      ? { user: userSession, area: 'admin' }
      : await this.portalSessionForUser(user.id, userSession);

    const sessionToken = this.createSessionToken();
    await this.database.db.insert(authSessions).values({
      userId: user.id,
      activeWorkspaceId:
        session.area === 'portal' ? session.workspace.id : null,
      tokenHash: this.hashSessionToken(sessionToken),
      expiresAt: this.sessionExpiry(),
    });

    return this.buildAuthentication(session, sessionToken);
  }

  async getSession(
    sessionToken: string | undefined,
  ): Promise<AuthSession | null> {
    if (!sessionToken) return null;

    const [session] = await this.database.db
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        isPlatformAdmin: users.isPlatformAdmin,
        activeWorkspaceId: authSessions.activeWorkspaceId,
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(
        and(
          eq(authSessions.tokenHash, this.hashSessionToken(sessionToken)),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
          eq(users.status, 'active'),
        ),
      )
      .limit(1);

    if (!session) return null;

    const user = {
      id: session.userId,
      email: session.email,
      displayName: session.displayName,
    };
    if (session.isPlatformAdmin) {
      return { user, area: 'admin' };
    }
    if (!session.activeWorkspaceId) return null;

    const [workspace] = await this.database.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMemberships.role,
      })
      .from(workspaceMemberships)
      .innerJoin(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      )
      .where(
        and(
          eq(workspaceMemberships.workspaceId, session.activeWorkspaceId),
          eq(workspaceMemberships.userId, session.userId),
          eq(workspaceMemberships.status, 'active'),
        ),
      )
      .limit(1);

    if (!workspace) return null;
    return { user, area: 'portal', workspace };
  }

  async refresh(sessionToken: string | undefined) {
    const session = await this.getSession(sessionToken);
    if (!session || !sessionToken) {
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);
    }

    return {
      session,
      accessToken: await this.signAccessToken(session, sessionToken),
      sessionToken,
    };
  }

  async logout(sessionToken: string | undefined) {
    if (!sessionToken) return;

    await this.database.db
      .update(authSessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(authSessions.tokenHash, this.hashSessionToken(sessionToken)),
          isNull(authSessions.revokedAt),
        ),
      );
  }

  private async portalSessionForUser(
    userId: string,
    user: PlatformAdminAuthSession['user'],
  ): Promise<PortalAuthSession> {
    const workspace = await this.findActiveWorkspace(userId);
    if (!workspace) {
      throw new AppException(
        'AUTH_WORKSPACE_UNAVAILABLE',
        HttpStatus.FORBIDDEN,
      );
    }
    return { user, area: 'portal', workspace };
  }

  private async buildAuthentication(
    session: AuthSession,
    sessionToken: string,
  ) {
    return {
      session,
      accessToken: await this.signAccessToken(session, sessionToken),
      sessionToken,
    };
  }

  private async signAccessToken(session: AuthSession, sessionToken: string) {
    return this.jwt.signAsync({
      sub: session.user.id,
      area: session.area,
      ...(session.area === 'portal'
        ? { workspaceId: session.workspace.id }
        : {}),
      sessionHash: this.hashSessionToken(sessionToken),
    });
  }

  private async findActiveWorkspace(userId: string) {
    const [workspace] = await this.database.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMemberships.role,
      })
      .from(workspaceMemberships)
      .innerJoin(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      )
      .where(
        and(
          eq(workspaceMemberships.userId, userId),
          eq(workspaceMemberships.status, 'active'),
        ),
      )
      .limit(1);

    return workspace;
  }

  private createSessionToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashSessionToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private sessionExpiry() {
    return new Date(Date.now() + sessionLifetimeSeconds * 1000);
  }

  private personalWorkspaceSlug(displayName: string) {
    const base = displayName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 72);

    return `${base || 'workspace'}-${randomUUID().slice(0, 8)}`;
  }
}
