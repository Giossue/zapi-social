import argon2 from 'argon2'
import { randomUUID } from 'node:crypto'
import {
  createDatabase,
  users,
  workspaceMemberships,
  workspaces,
} from '@workspace/database'
import { and, eq, sql } from '@workspace/database/query'

type SeedUser = {
  email: string
  password: string
  displayName: string
}

type WorkspaceRole = 'owner' | 'admin' | 'member'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function seedUser(prefix: 'SEED_ADMIN' | 'SEED_MEMBER'): SeedUser {
  return {
    email: required(`${prefix}_EMAIL`).toLowerCase(),
    password: required(`${prefix}_PASSWORD`),
    displayName:
      process.env[`${prefix}_DISPLAY_NAME`]?.trim() ||
      (prefix === 'SEED_ADMIN' ? 'Zapi Admin' : 'Zapi Member'),
  }
}

function memberRole(): WorkspaceRole {
  const value = process.env.SEED_MEMBER_ROLE?.trim() || 'owner'
  if (value === 'owner' || value === 'admin' || value === 'member') return value
  throw new Error('SEED_MEMBER_ROLE must be owner, admin, or member')
}

async function main() {
  const databaseUrl = required('DATABASE_URL')
  const admin = seedUser('SEED_ADMIN')
  const member = seedUser('SEED_MEMBER')
  const role = memberRole()

  if (admin.email === member.email) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_MEMBER_EMAIL must be different')
  }

  const { client, db } = createDatabase(databaseUrl)

  try {
    await db.transaction(async (tx) => {
      async function ensureUser(input: SeedUser, isPlatformAdmin: boolean) {
        const [existing] = await tx
          .select({ id: users.id, isPlatformAdmin: users.isPlatformAdmin })
          .from(users)
          .where(eq(sql`lower(${users.email})`, input.email))
          .limit(1)

        if (existing) return existing

        const passwordHash = await argon2.hash(input.password)
        const [created] = await tx
          .insert(users)
          .values({
            email: input.email,
            displayName: input.displayName,
            passwordHash,
            status: 'active',
            isPlatformAdmin,
          })
          .returning({ id: users.id, isPlatformAdmin: users.isPlatformAdmin })

        return created
      }

      const adminUser = await ensureUser(admin, true)
      const memberUser = await ensureUser(member, false)

      const [adminWorkspaceAssociation] = await tx
        .select({ id: workspaceMemberships.id })
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.userId, adminUser.id))
        .limit(1)
      const [adminOwnedWorkspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.ownerUserId, adminUser.id))
        .limit(1)

      if (adminWorkspaceAssociation || adminOwnedWorkspace) {
        throw new Error(
          'SEED_ADMIN user already has workspace associations and cannot be a PlatformAdmin',
        )
      }

      if (!adminUser.isPlatformAdmin) {
        await tx
          .update(users)
          .set({ isPlatformAdmin: true, updatedAt: new Date() })
          .where(eq(users.id, adminUser.id))
      }

      if (memberUser.isPlatformAdmin) {
        await tx
          .update(users)
          .set({ isPlatformAdmin: false, updatedAt: new Date() })
          .where(eq(users.id, memberUser.id))
      }

      const [existingWorkspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.ownerUserId, memberUser.id),
            eq(workspaces.kind, 'personal'),
          ),
        )
        .limit(1)

      const workspace =
        existingWorkspace ??
        (
          await tx
            .insert(workspaces)
            .values({
              ownerUserId: memberUser.id,
              name: 'Zapi member workspace',
              slug: `zapi-member-${randomUUID().slice(0, 8)}`,
              kind: 'personal',
            })
            .returning({ id: workspaces.id })
        )[0]

      await tx
        .insert(workspaceMemberships)
        .values({ workspaceId: workspace.id, userId: memberUser.id, role })
        .onConflictDoUpdate({
          target: [workspaceMemberships.workspaceId, workspaceMemberships.userId],
          set: { role, status: 'active', updatedAt: new Date() },
        })
    })

    console.log('PlatformAdmin and PortalUser seeds are ready.')
  } finally {
    await client.end()
  }
}

void main()
