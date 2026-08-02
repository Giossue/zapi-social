import { HttpStatus, Injectable } from '@nestjs/common';
import {
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
} from '@workspace/contracts';
import {
  auditLogs,
  authSessions,
  passwordResetTokens,
  users,
} from '@workspace/database';
import { and, eq, gt, isNull, sql } from '@workspace/database/query';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { AppException } from '../platform/errors/app-exception';

const passwordResetLifetimeMilliseconds = 60 * 60 * 1000;
const genericRequestResponse = { accepted: true as const };

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly database: DatabaseService,
    private readonly email: EmailService,
  ) {}

  async request(input: unknown) {
    const parsed = passwordResetRequestSchema.safeParse(input);
    if (!parsed.success) return genericRequestResponse;

    const [user] = await this.database.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          eq(sql`lower(${users.email})`, parsed.data.email.toLowerCase()),
          eq(users.status, 'active'),
        ),
      )
      .limit(1);

    if (!user) return genericRequestResponse;

    const token = randomBytes(48).toString('base64url');
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({ expiresAt: now })
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            isNull(passwordResetTokens.consumedAt),
            gt(passwordResetTokens.expiresAt, now),
          ),
        );

      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(now.getTime() + passwordResetLifetimeMilliseconds),
      });
      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        event: 'auth.password_reset_requested',
        subjectType: 'user',
        subjectId: user.id,
        metadata: {},
      });
    });

    try {
      await this.email.sendPasswordReset(user.email, token);
    } catch {
      // Deliberately preserve the generic public response and do not log email configuration or tokens.
    }
    return genericRequestResponse;
  }

  async confirm(input: unknown): Promise<void> {
    const parsed = passwordResetConfirmSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppException(
        'AUTH_PASSWORD_POLICY_NOT_MET',
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = new Date();
    const passwordHash = await argon2.hash(parsed.data.password);
    const [token] = await this.database.db.transaction(async (tx) => {
      const consumed = await tx
        .update(passwordResetTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(
              passwordResetTokens.tokenHash,
              this.hashToken(parsed.data.token),
            ),
            isNull(passwordResetTokens.consumedAt),
            gt(passwordResetTokens.expiresAt, now),
          ),
        )
        .returning({ userId: passwordResetTokens.userId });

      const result = consumed[0];
      if (!result) {
        throw new AppException(
          'AUTH_PASSWORD_RESET_TOKEN_INVALID',
          HttpStatus.BAD_REQUEST,
        );
      }

      await tx
        .update(users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(users.id, result.userId));
      await tx
        .update(authSessions)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(authSessions.userId, result.userId),
            isNull(authSessions.revokedAt),
          ),
        );
      await tx.insert(auditLogs).values({
        actorUserId: result.userId,
        event: 'auth.password_reset_confirmed',
        subjectType: 'user',
        subjectId: result.userId,
        metadata: {},
      });
      return [result];
    });

    if (!token) {
      throw new AppException(
        'AUTH_PASSWORD_RESET_TOKEN_INVALID',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
