import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import {
  affiliateCommissions,
  affiliateProfiles,
  affiliateReferrals,
  commerceOrders,
  commerceReturnRequests,
  createDatabase,
  users,
  workspaces,
  type Database,
} from '@workspace/database';
import { eq, inArray, sql } from '@workspace/database/query';
import type { PortalAuthSession } from '@workspace/contracts';
import { AffiliateService } from './affiliate/affiliate.service';
import { CommerceService } from './commerce/commerce.service';
import { DatabaseService } from './database/database.service';
import { IdentityService } from './identity/identity.service';
import { AppException } from './platform/errors/app-exception';

const databaseUrl = process.env.PORTAL_BACKEND_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();

const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback commerce and affiliate integrity test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) throw new Error('Local test database is unavailable.');
  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function seedWorkspace(database: Database, suffix: string) {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const now = new Date();
  await database.insert(users).values({
    createdAt: now,
    displayName: `Integrity ${suffix}`,
    email: `integrity-${suffix}-${userId}@example.test`,
    id: userId,
    updatedAt: now,
  });
  await database.insert(workspaces).values({
    createdAt: now,
    id: workspaceId,
    name: `Integrity ${suffix}`,
    ownerUserId: userId,
    slug: `integrity-${suffix}-${workspaceId.slice(0, 8)}`,
    updatedAt: now,
  });
  const session: PortalAuthSession = {
    area: 'portal',
    user: {
      displayName: `Integrity ${suffix}`,
      email: `integrity-${suffix}@example.test`,
      id: userId,
    },
    workspace: {
      id: workspaceId,
      name: `Integrity ${suffix}`,
      role: 'owner',
      slug: `integrity-${suffix}`,
    },
    workspaces: [
      {
        id: workspaceId,
        name: `Integrity ${suffix}`,
        role: 'owner',
        slug: `integrity-${suffix}`,
      },
    ],
  };
  return { session, userId, workspaceId };
}

describeDatabase('Commerce and affiliate data integrity', () => {
  afterAll(async () => {
    await connection?.client.end();
  });

  it('aggregates all commerce orders while returning only the latest 100', async () => {
    await inRollbackTransaction(async (database) => {
      const owner = await seedWorkspace(database, 'commerce-aggregate');
      const now = new Date();
      await database.insert(commerceOrders).values(
        Array.from({ length: 101 }, (_, index) => ({
          channel: 'store' as const,
          createdAt: now,
          createdByUserId: owner.userId,
          currency: 'USD',
          customerName: `Buyer ${index}`,
          orderedAt: new Date(now.getTime() - index),
          status: 'completed' as const,
          totalMinor: 100,
          updatedAt: now,
          workspaceId: owner.workspaceId,
        })),
      );
      const service = new CommerceService({ db: database } as DatabaseService);

      const dashboard = await service.dashboard(owner.session, {
        channel: 'all',
        period: 'month',
      });

      expect(dashboard.orders).toHaveLength(100);
      expect(dashboard.metrics).toMatchObject({
        averageOrderMinor: 100,
        orderCount: 101,
        salesMinor: 10_100,
      });
    });
  });

  it('aggregates every affiliate commission independently of the list limit', async () => {
    await inRollbackTransaction(async (database) => {
      const owner = await seedWorkspace(database, 'affiliate-aggregate');
      const [profile] = await database
        .insert(affiliateProfiles)
        .values({ code: `code-${randomUUID()}`, userId: owner.userId })
        .returning();
      if (!profile) throw new Error('Affiliate profile was not created.');
      await database.insert(affiliateCommissions).values(
        Array.from({ length: 101 }, (_, index) => ({
          affiliateProfileId: profile.id,
          amountMinor: index + 1,
          currency: 'USD',
          status: 'pending' as const,
        })),
      );
      const service = new AffiliateService({
        db: database,
      } as DatabaseService);

      const dashboard = await service.dashboard(owner.session);

      expect(dashboard.commissions).toHaveLength(100);
      expect(dashboard.totals.pendingMinor).toBe(5151);
    });
  });

  it('serializes returns and prevents their active total from exceeding the order', async () => {
    if (!connection) throw new Error('Local test database is unavailable.');
    const owner = await seedWorkspace(connection.db, 'return-lock');
    try {
      const [order] = await connection.db
        .insert(commerceOrders)
        .values({
          channel: 'store',
          createdByUserId: owner.userId,
          currency: 'USD',
          customerName: 'Return lock buyer',
          status: 'completed',
          totalMinor: 100,
          workspaceId: owner.workspaceId,
        })
        .returning();
      if (!order) throw new Error('Commerce order was not created.');
      await connection.db.insert(commerceReturnRequests).values({
        amountMinor: 100,
        commerceOrderId: order.id,
        reason: 'Rejected historical return',
        status: 'rejected',
        workspaceId: owner.workspaceId,
      });
      const service = new CommerceService({
        db: connection.db,
      } as DatabaseService);

      const competing = await Promise.allSettled([
        service.createReturn(owner.session, {
          amountMinor: 60,
          orderId: order.id,
          reason: 'First competing return',
        }),
        service.createReturn(owner.session, {
          amountMinor: 60,
          orderId: order.id,
          reason: 'Second competing return',
        }),
      ]);

      expect(
        competing.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        competing.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      await service.createReturn(owner.session, {
        amountMinor: 40,
        orderId: order.id,
        reason: 'Remaining refundable amount',
      });
      await expect(
        service.createReturn(owner.session, {
          amountMinor: 1,
          orderId: order.id,
          reason: 'Exceeds refundable amount',
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      } satisfies Partial<AppException>);
      const [totals] = await connection.db
        .select({
          amountMinor: sql<number>`sum(${commerceReturnRequests.amountMinor}) filter (where ${commerceReturnRequests.status} <> 'rejected')::int`,
        })
        .from(commerceReturnRequests)
        .where(eq(commerceReturnRequests.commerceOrderId, order.id));

      expect(totals?.amountMinor).toBe(100);
    } finally {
      await connection.db
        .delete(workspaces)
        .where(eq(workspaces.id, owner.workspaceId));
      await connection.db.delete(users).where(eq(users.id, owner.userId));
    }
  });

  it('allows only one registration to claim a visited referral', async () => {
    if (!connection) throw new Error('Local test database is unavailable.');
    const affiliateUserId = randomUUID();
    const suffix = randomUUID();
    const emails = [
      `claim-a-${suffix}@example.test`,
      `claim-b-${suffix}@example.test`,
    ];
    await connection.db.insert(users).values({
      displayName: 'Affiliate claimant test',
      email: `affiliate-${suffix}@example.test`,
      id: affiliateUserId,
    });
    const [profile] = await connection.db
      .insert(affiliateProfiles)
      .values({ code: `claim-${suffix}`, userId: affiliateUserId })
      .returning();
    if (!profile) throw new Error('Affiliate profile was not created.');
    const [referral] = await connection.db
      .insert(affiliateReferrals)
      .values({ affiliateProfileId: profile.id })
      .returning();
    if (!referral) throw new Error('Affiliate referral was not created.');
    try {
      const service = new IdentityService(
        { db: connection.db } as DatabaseService,
        new JwtService({ secret: 'identity-integrity-test-secret' }),
      );

      const registrations = await Promise.all([
        service.register({
          displayName: `Claim A ${suffix}`,
          email: emails[0],
          password: 'Valid-password-1!',
          timezone: 'America/Guayaquil',
          referralId: referral.id,
        }),
        service.register({
          displayName: `Claim B ${suffix}`,
          email: emails[1],
          password: 'Valid-password-1!',
          timezone: 'America/Guayaquil',
          referralId: referral.id,
        }),
      ]);
      const [claimed] = await connection.db
        .select()
        .from(affiliateReferrals)
        .where(eq(affiliateReferrals.id, referral.id));

      expect(claimed?.status).toBe('registered');
      expect(
        registrations.some(
          (registration) =>
            registration.session.user.id === claimed?.referredUserId,
        ),
      ).toBe(true);
    } finally {
      const registeredUsers = await connection.db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.email, emails));
      if (registeredUsers.length) {
        const userIds = registeredUsers.map((user) => user.id);
        await connection.db
          .delete(workspaces)
          .where(inArray(workspaces.ownerUserId, userIds));
        await connection.db.delete(users).where(inArray(users.id, userIds));
      }
      await connection.db.delete(users).where(eq(users.id, affiliateUserId));
    }
  });
});
