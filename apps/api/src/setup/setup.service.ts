import { HttpStatus, Injectable } from '@nestjs/common';
import {
  createSetupAdminSchema,
  planLimitsSchema,
  portalModuleKeys,
  type SetupStatus,
} from '@workspace/contracts';
import { apiAuditLogs, plans, users } from '@workspace/database';
import { count, sql } from '@workspace/database/query';
import argon2 from 'argon2';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const setupLockId = 1_515_211_081;
const freeLimits = planLimitsSchema.parse({
  maxChannels: 2,
  maxPostsPerMonth: 30,
  maxTeamMembers: 1,
  maxStorageMb: 256,
  maxFileSizeMb: 25,
  aiVideoMaxSeconds: 0,
  creditsPerMonth: 25,
  enabledModules: ['publishing', 'captions', 'files', 'boards'],
});
const growthLimits = planLimitsSchema.parse({
  maxChannels: 10,
  maxPostsPerMonth: 300,
  maxTeamMembers: 5,
  maxStorageMb: 5_120,
  maxFileSizeMb: 250,
  aiVideoMaxSeconds: 60,
  creditsPerMonth: 500,
  enabledModules: [...portalModuleKeys],
});

@Injectable()
export class SetupService {
  constructor(private readonly database: DatabaseService) {}

  async status(): Promise<SetupStatus> {
    const [status] = await this.database.db
      .select({
        total: count(),
        platformAdmins: sql<number>`count(*) filter (where ${users.isPlatformAdmin} = true)::int`,
      })
      .from(users);
    const total = status?.total ?? 0;
    const platformAdmins = status?.platformAdmins ?? 0;
    if (total === 0) return { needsSetup: true, state: 'required' };
    if (platformAdmins > 0) return { needsSetup: false, state: 'complete' };
    return { needsSetup: false, state: 'blocked' };
  }

  async createAdmin(input: unknown) {
    if (!(await this.status()).needsSetup) {
      throw new AppException('SETUP_ALREADY_COMPLETED', HttpStatus.CONFLICT);
    }
    const parsed = createSetupAdminSchema.safeParse(input);
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
    const passwordHash = await argon2.hash(data.password);

    await this.database.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${setupLockId})`);
      const [{ total }] = await tx.select({ total: count() }).from(users);
      if (total > 0) {
        throw new AppException('SETUP_ALREADY_COMPLETED', HttpStatus.CONFLICT);
      }

      const [admin] = await tx
        .insert(users)
        .values({
          email: data.email.toLowerCase(),
          displayName: data.displayName,
          passwordHash,
          timezone: data.timezone,
          isPlatformAdmin: true,
          status: 'active',
        })
        .returning({ id: users.id });
      if (!admin) {
        throw new AppException(
          'INTERNAL_SERVER_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      await tx.insert(plans).values([
        {
          name: 'Gratis',
          slug: 'gratis',
          status: 'active',
          currency: 'USD',
          price: '0',
          billingType: 'monthly',
          isFree: true,
          isDefaultSignup: true,
          trialDays: 0,
          position: 1,
          description: 'Plan inicial editable para nuevos espacios de trabajo.',
          permissionIds: [
            'workspace.view',
            'publishing.create',
            'reporting.view',
          ],
          limits: freeLimits,
          createdByUserId: admin.id,
          updatedByUserId: admin.id,
        },
        {
          name: 'Crecimiento',
          slug: 'crecimiento',
          status: 'active',
          featured: true,
          currency: 'USD',
          price: '29',
          billingType: 'monthly',
          isFree: false,
          isDefaultSignup: false,
          trialDays: 14,
          position: 2,
          description: 'Plan editable para equipos con publicación frecuente.',
          permissionIds: [
            'workspace.view',
            'workspace.members',
            'publishing.create',
            'publishing.schedule',
            'rss_schedules.view',
            'rss_schedules.manage',
            'reporting.view',
          ],
          limits: growthLimits,
          createdByUserId: admin.id,
          updatedByUserId: admin.id,
        },
      ]);

      await tx.insert(apiAuditLogs).values({
        actorUserId: admin.id,
        event: 'setup.completed',
        subjectType: 'user',
        subjectId: admin.id,
        severity: 'success',
        outcome: 'succeeded',
        summary: 'Initial Platform Admin and starter plans created',
        metadata: { planSlugs: ['gratis', 'crecimiento'] },
      });
    });

    return { created: true as const };
  }
}
