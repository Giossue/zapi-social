import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import {
  createDatabase,
  users,
  workspaceMemberships,
  workspaces,
} from '@workspace/database';
import { and, eq, sql } from '@workspace/database/query';

type SeedUser = {
  email: string;
  password: string;
  displayName: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function seedUser(prefix: 'SEED_ADMIN' | 'SEED_MEMBER'): SeedUser {
  return {
    email: required(`${prefix}_EMAIL`).toLowerCase(),
    password: required(`${prefix}_PASSWORD`),
    displayName:
      process.env[`${prefix}_DISPLAY_NAME`]?.trim() ||
      (prefix === 'SEED_ADMIN' ? 'Zapi Admin' : 'Zapi Member'),
  };
}

async function main() {
  const databaseUrl = required('DATABASE_URL');
  const admin = seedUser('SEED_ADMIN');
  const member = seedUser('SEED_MEMBER');

  if (admin.email === member.email) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_MEMBER_EMAIL must be different');
  }

  const { client, db } = createDatabase(databaseUrl);

  try {
    await db.transaction(async (tx) => {
      async function ensureUser(input: SeedUser) {
        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(sql`lower(${users.email})`, input.email))
          .limit(1);

        if (existing) return existing;

        const passwordHash = await argon2.hash(input.password);
        const [created] = await tx
          .insert(users)
          .values({
            email: input.email,
            displayName: input.displayName,
            passwordHash,
            status: 'active',
          })
          .returning({ id: users.id });

        return created;
      }

      const adminUser = await ensureUser(admin);
      const memberUser = await ensureUser(member);

      const [existingWorkspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.ownerUserId, adminUser.id))
        .limit(1);

      const workspace =
        existingWorkspace ??
        (
          await tx
            .insert(workspaces)
            .values({
              ownerUserId: adminUser.id,
              name: 'Zapi workspace',
              slug: `zapi-${randomUUID().slice(0, 8)}`,
            })
            .returning({ id: workspaces.id })
        )[0];

      await tx
        .insert(workspaceMemberships)
        .values([
          { workspaceId: workspace.id, userId: adminUser.id, role: 'owner' },
          { workspaceId: workspace.id, userId: memberUser.id, role: 'member' },
        ])
        .onConflictDoUpdate({
          target: [
            workspaceMemberships.workspaceId,
            workspaceMemberships.userId,
          ],
          set: { status: 'active' },
        });
    });

    console.log('Seed users are ready.');
  } finally {
    await client.end();
  }
}

void main();
