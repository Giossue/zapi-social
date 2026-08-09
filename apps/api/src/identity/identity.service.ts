import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  authSessions,
  affiliateProfiles,
  affiliateReferrals,
  users,
  workspaceMemberships,
  workspaces,
} from '@workspace/database';
import {
  activateAuthWorkspaceSchema,
  loginSchema,
  registerSchema,
  type ActiveWorkspace,
  type AuthSession,
  type PlatformAdminAuthSession,
  type PortalAuthSession,
} from '@workspace/contracts';
import { and, eq, gt, isNull, sql } from '@workspace/database/query';
import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const rememberedSessionLifetimeSeconds = 60 * 60 * 24 * 30;
const temporarySessionLifetimeSeconds = 60 * 60 * 24;

@Injectable()
export class IdentityService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: unknown) {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      const passwordInvalid = parsed.error.issues.some(
        (issue) => issue.path[0] === 'password',
      );
      throw new AppException(
        passwordInvalid ? 'AUTH_PASSWORD_POLICY_NOT_MET' : 'VALIDATION_FAILED',
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
          timezone: data.timezone,
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

      if (data.referralId) {
        await tx
          .update(affiliateReferrals)
          .set({
            referredUserId: user.id,
            status: 'registered',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(affiliateReferrals.id, data.referralId),
              eq(affiliateReferrals.status, 'visited'),
              sql`exists (
                select 1
                from ${affiliateProfiles}
                where ${affiliateProfiles.id} = ${affiliateReferrals.affiliateProfileId}
                  and ${affiliateProfiles.status} = 'active'
              )`,
            ),
          )
          .returning({ id: affiliateReferrals.id });
      }

      return {
        user,
        area: 'portal' as const,
        workspace: { ...workspace, role: 'owner' as const },
        workspaces: [{ ...workspace, role: 'owner' as const }],
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
      remembered: data.remember,
      expiresAt: this.sessionExpiry(data.remember),
    });

    return {
      ...(await this.buildAuthentication(session, sessionToken)),
      remember: data.remember,
    };
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
    const availableWorkspaces = await this.activeWorkspacesForUser(
      session.userId,
    );
    const workspace = availableWorkspaces.find(
      ({ id }) => id === session.activeWorkspaceId,
    );
    if (!workspace) return null;
    return {
      user,
      area: 'portal' as const,
      workspace,
      workspaces: availableWorkspaces,
    };
  }

  async activateWorkspace(sessionToken: string | undefined, input: unknown) {
    const parsed = activateAuthWorkspaceSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    if (!sessionToken)
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);

    const tokenHash = this.hashSessionToken(sessionToken);
    const [storedSession] = await this.database.db
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        isPlatformAdmin: users.isPlatformAdmin,
        remembered: authSessions.remembered,
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
          eq(users.status, 'active'),
        ),
      )
      .limit(1);
    if (!storedSession || storedSession.isPlatformAdmin) {
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);
    }

    const availableWorkspaces = await this.activeWorkspacesForUser(
      storedSession.userId,
    );
    const workspace = availableWorkspaces.find(
      ({ id }) => id === parsed.data.workspaceId,
    );
    if (!workspace) {
      throw new AppException(
        'AUTH_WORKSPACE_UNAVAILABLE',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.database.db
      .update(authSessions)
      .set({ activeWorkspaceId: workspace.id, updatedAt: new Date() })
      .where(eq(authSessions.tokenHash, tokenHash));
    const session: PortalAuthSession = {
      user: {
        id: storedSession.userId,
        email: storedSession.email,
        displayName: storedSession.displayName,
      },
      area: 'portal',
      workspace,
      workspaces: availableWorkspaces,
    };
    return {
      ...(await this.buildAuthentication(session, sessionToken)),
      remember: storedSession.remembered,
    };
  }

  async refresh(sessionToken: string | undefined) {
    const session = await this.getSession(sessionToken);
    if (!session || !sessionToken) {
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);
    }

    const [storedSession] = await this.database.db
      .select({ remembered: authSessions.remembered })
      .from(authSessions)
      .where(
        and(
          eq(authSessions.tokenHash, this.hashSessionToken(sessionToken)),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return {
      session,
      accessToken: await this.signAccessToken(session, sessionToken),
      sessionToken,
      remember: storedSession?.remembered ?? false,
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
    const availableWorkspaces = await this.activeWorkspacesForUser(userId);
    const workspace = availableWorkspaces[0];
    if (!workspace) {
      throw new AppException(
        'AUTH_WORKSPACE_UNAVAILABLE',
        HttpStatus.FORBIDDEN,
      );
    }
    return { user, area: 'portal', workspace, workspaces: availableWorkspaces };
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

  private async activeWorkspacesForUser(
    userId: string,
  ): Promise<ActiveWorkspace[]> {
    const rows = await this.database.db
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
      .orderBy(workspaceMemberships.joinedAt);

    return rows.map((workspace) => ({
      ...workspace,
      role: workspace.role as ActiveWorkspace['role'],
    }));
  }

  private createSessionToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashSessionToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private sessionExpiry(remember = true) {
    const lifetime = remember
      ? rememberedSessionLifetimeSeconds
      : temporarySessionLifetimeSeconds;
    return new Date(Date.now() + lifetime * 1000);
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
