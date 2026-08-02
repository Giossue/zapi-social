import { HttpStatus, Injectable } from '@nestjs/common';
import {
  changePortalPasswordSchema,
  updatePortalProfileSchema,
  type PortalAuthSession,
  type PortalProfile,
} from '@workspace/contracts';
import { auditLogs, users } from '@workspace/database';
import { eq } from '@workspace/database/query';
import argon2 from 'argon2';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

@Injectable()
export class PortalProfileService {
  constructor(private readonly database: DatabaseService) {}

  async getProfile(session: PortalAuthSession): Promise<PortalProfile> {
    const user = await this.findUser(session.user.id);
    return this.toProfile(user);
  }

  async updateProfile(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<PortalProfile> {
    const parsed = updatePortalProfileSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const [user] = await this.database.db
      .update(users)
      .set({
        displayName: parsed.data.displayName,
        locale: parsed.data.locale,
        timezone: parsed.data.timezone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning(this.profileSelection());

    if (!user)
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);

    await this.database.db.insert(auditLogs).values({
      workspaceId: session.workspace.id,
      actorUserId: session.user.id,
      event: 'profile.updated',
      subjectType: 'user',
      subjectId: session.user.id,
      metadata: {
        changedFields: ['displayName', 'locale', 'timezone'],
      },
    });

    return this.toProfile(user);
  }

  async changePassword(
    session: PortalAuthSession,
    input: unknown,
  ): Promise<void> {
    const parsed = changePortalPasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException(
        'AUTH_PASSWORD_POLICY_NOT_MET',
        HttpStatus.BAD_REQUEST,
      );
    }

    const [user] = await this.database.db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user?.passwordHash)
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);

    const validPassword = await argon2.verify(
      user.passwordHash,
      parsed.data.currentPassword,
    );
    if (!validPassword) {
      throw new AppException(
        'AUTH_CURRENT_PASSWORD_INVALID',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.database.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash: await argon2.hash(parsed.data.newPassword),
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.user.id));

      await tx.insert(auditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'profile.password_updated',
        subjectType: 'user',
        subjectId: session.user.id,
        metadata: {},
      });
    });
  }

  private async findUser(id: string) {
    const [user] = await this.database.db
      .select(this.profileSelection())
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user || user.status !== 'active') {
      throw new AppException('AUTH_SESSION_EXPIRED', HttpStatus.UNAUTHORIZED);
    }
    return user;
  }

  private profileSelection() {
    return {
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      username: users.username,
      emailVerifiedAt: users.emailVerifiedAt,
      locale: users.locale,
      timezone: users.timezone,
      createdAt: users.createdAt,
      status: users.status,
    };
  }

  private toProfile(
    user: Awaited<ReturnType<PortalProfileService['findUser']>>,
  ): PortalProfile {
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      username: user.username,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      locale: user.locale === 'es' || user.locale === 'en' ? user.locale : null,
      timezone: user.timezone,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
