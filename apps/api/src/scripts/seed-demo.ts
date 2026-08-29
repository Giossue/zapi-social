import {
  boardColumns,
  boardTasks,
  createDatabase,
  publishingPosts,
  socialAccountMemberships,
  socialAccounts,
  users,
  workspaceMemberships,
  workspaceNotifications,
} from '@workspace/database';
import { and, eq, sql } from '@workspace/database/query';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function shiftedDate(days: number, hours = 0) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(value.getUTCHours() + hours);
  return value;
}

async function main() {
  const databaseUrl = required('DATABASE_URL');
  const ownerEmail = required('DEMO_OWNER_EMAIL').toLowerCase();
  const { client, db } = createDatabase(databaseUrl);

  try {
    await db.transaction(async (tx) => {
      const [owner] = await tx
        .select({
          userId: users.id,
          workspaceId: workspaceMemberships.workspaceId,
          membershipId: workspaceMemberships.id,
        })
        .from(users)
        .innerJoin(
          workspaceMemberships,
          eq(workspaceMemberships.userId, users.id),
        )
        .where(
          and(
            eq(sql`lower(${users.email})`, ownerEmail),
            eq(users.isPlatformAdmin, false),
            eq(workspaceMemberships.role, 'owner'),
            eq(workspaceMemberships.status, 'active'),
          ),
        )
        .limit(1);

      if (!owner) {
        throw new Error(
          'DEMO_OWNER_EMAIL must belong to an active Portal workspace owner',
        );
      }

      async function ensureAccount(input: {
        providerKey: string;
        capabilityKey: string;
        externalId: string;
        displayName: string;
        handle: string;
      }) {
        const [existing] = await tx
          .select({ id: socialAccounts.id })
          .from(socialAccounts)
          .where(
            and(
              eq(socialAccounts.workspaceId, owner.workspaceId),
              eq(socialAccounts.externalId, input.externalId),
            ),
          )
          .limit(1);
        const connectedAt = shiftedDate(-12);
        const account = existing
          ? (
              await tx
                .update(socialAccounts)
                .set({
                  providerKey: input.providerKey,
                  capabilityKey: input.capabilityKey,
                  displayName: input.displayName,
                  handle: input.handle,
                  status: 'active',
                  connectedAt,
                  metadata: { demo: true },
                  updatedAt: new Date(),
                })
                .where(eq(socialAccounts.id, existing.id))
                .returning({ id: socialAccounts.id })
            )[0]
          : (
              await tx
                .insert(socialAccounts)
                .values({
                  workspaceId: owner.workspaceId,
                  ...input,
                  status: 'active',
                  connectedAt,
                  metadata: { demo: true },
                })
                .returning({ id: socialAccounts.id })
            )[0];
        if (!account) throw new Error('Unable to seed a demo social account');
        await tx
          .insert(socialAccountMemberships)
          .values({
            socialAccountId: account.id,
            workspaceMembershipId: owner.membershipId,
          })
          .onConflictDoNothing();
        return account.id;
      }

      const instagramId = await ensureAccount({
        providerKey: 'instagram',
        capabilityKey: 'instagram_content_publish',
        externalId: 'zapi-demo-instagram',
        displayName: 'Zapi Coffee',
        handle: '@zapicoffee',
      });
      const facebookId = await ensureAccount({
        providerKey: 'facebook',
        capabilityKey: 'facebook_pages',
        externalId: 'zapi-demo-facebook',
        displayName: 'Zapi Coffee Community',
        handle: '@zapicoffeecommunity',
      });

      const published = [
        { days: -2, content: 'A better morning starts with better coffee.' },
        { days: -5, content: "Behind the scenes: roasting this week's batch." },
        { days: -8, content: 'Three ways to brew a smoother cup at home.' },
        { days: -13, content: 'Meet the farmers behind our seasonal blend.' },
        { days: -19, content: 'Community favorite: the cold brew guide.' },
        { days: -34, content: 'A quick tour of our neighborhood coffee bar.' },
      ];
      const accountIds = [instagramId, facebookId];

      for (const [index, post] of published.entries()) {
        const reference = `zapi-demo-published-${index + 1}`;
        const occurredAt = shiftedDate(post.days);
        const accountId = accountIds[index % accountIds.length];
        const [existing] = await tx
          .select({ id: publishingPosts.id })
          .from(publishingPosts)
          .where(
            and(
              eq(publishingPosts.workspaceId, owner.workspaceId),
              eq(publishingPosts.externalReference, reference),
            ),
          )
          .limit(1);
        const values = {
          authorUserId: owner.userId,
          socialAccountId: accountId,
          status: 'published' as const,
          content: post.content,
          source: 'demo',
          externalReference: reference,
          publishedAt: occurredAt,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        };
        if (existing) {
          await tx
            .update(publishingPosts)
            .set(values)
            .where(eq(publishingPosts.id, existing.id));
        } else {
          await tx.insert(publishingPosts).values({
            workspaceId: owner.workspaceId,
            ...values,
          });
        }
      }

      const drafts = [
        'Five coffee rituals worth trying this weekend.',
        'New seasonal menu: first look and tasting notes.',
        'Ask our roaster: send us your brewing questions.',
      ];
      for (const [index, content] of drafts.entries()) {
        const reference = `zapi-demo-draft-${index + 1}`;
        const accountId = accountIds[index % accountIds.length];
        const [existing] = await tx
          .select({ id: publishingPosts.id })
          .from(publishingPosts)
          .where(
            and(
              eq(publishingPosts.workspaceId, owner.workspaceId),
              eq(publishingPosts.externalReference, reference),
            ),
          )
          .limit(1);
        const values = {
          authorUserId: owner.userId,
          socialAccountId: accountId,
          status: 'draft' as const,
          content,
          source: 'demo',
          externalReference: reference,
          scheduledAt: null,
          publishedAt: null,
          updatedAt: shiftedDate(0, -index),
        };
        if (existing) {
          await tx
            .update(publishingPosts)
            .set(values)
            .where(eq(publishingPosts.id, existing.id));
        } else {
          await tx.insert(publishingPosts).values({
            workspaceId: owner.workspaceId,
            ...values,
          });
        }
      }

      const columnInputs = [
        { name: 'Ideas', position: 0, color: '#64748b' },
        { name: 'In progress', position: 1, color: '#2563eb' },
        { name: 'Ready', position: 2, color: '#16a34a' },
      ];
      const columnIds = new Map<string, string>();
      for (const column of columnInputs) {
        const [existing] = await tx
          .select({ id: boardColumns.id })
          .from(boardColumns)
          .where(
            and(
              eq(boardColumns.workspaceId, owner.workspaceId),
              eq(boardColumns.name, column.name),
            ),
          )
          .limit(1);
        const record = existing
          ? (
              await tx
                .update(boardColumns)
                .set({ ...column, updatedAt: new Date() })
                .where(eq(boardColumns.id, existing.id))
                .returning({ id: boardColumns.id })
            )[0]
          : (
              await tx
                .insert(boardColumns)
                .values({ workspaceId: owner.workspaceId, ...column })
                .returning({ id: boardColumns.id })
            )[0];
        if (!record) throw new Error('Unable to seed a demo board column');
        columnIds.set(column.name, record.id);
      }

      const taskInputs = [
        {
          column: 'Ideas',
          title: 'Customer story carousel',
          description: 'Turn the latest customer interview into six slides.',
          priority: 'medium' as const,
          progress: 0,
          position: 0,
        },
        {
          column: 'In progress',
          title: 'Seasonal blend launch',
          description: 'Prepare launch copy for Instagram and Facebook.',
          priority: 'high' as const,
          progress: 65,
          position: 0,
        },
        {
          column: 'Ready',
          title: 'Weekend brewing tips',
          description: 'Final copy approved and ready for scheduling.',
          priority: 'low' as const,
          progress: 100,
          position: 0,
        },
      ];
      for (const task of taskInputs) {
        const columnId = columnIds.get(task.column);
        if (!columnId) throw new Error('Missing demo board column');
        const [existing] = await tx
          .select({ id: boardTasks.id })
          .from(boardTasks)
          .where(
            and(
              eq(boardTasks.workspaceId, owner.workspaceId),
              eq(boardTasks.title, task.title),
            ),
          )
          .limit(1);
        const values = {
          columnId,
          createdByUserId: owner.userId,
          assigneeUserId: owner.userId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          progress: task.progress,
          position: task.position,
          dueDate: shiftedDate(7).toISOString().slice(0, 10),
          completedAt: task.progress === 100 ? new Date() : null,
          archivedAt: null,
          updatedAt: new Date(),
        };
        if (existing) {
          await tx
            .update(boardTasks)
            .set(values)
            .where(eq(boardTasks.id, existing.id));
        } else {
          await tx.insert(boardTasks).values({
            workspaceId: owner.workspaceId,
            ...values,
          });
        }
      }

      const notifications = [
        {
          kind: 'demo.welcome',
          payload: { title: 'Welcome to the Zapi Social demo' },
          url: '/portal/dashboard',
          readAt: null,
        },
        {
          kind: 'demo.content-ready',
          payload: { title: 'Your tasks are ready to review' },
          url: '/portal/tasks',
          readAt: shiftedDate(0, -2),
        },
      ];
      for (const notification of notifications) {
        const [existing] = await tx
          .select({ id: workspaceNotifications.id })
          .from(workspaceNotifications)
          .where(
            and(
              eq(workspaceNotifications.workspaceId, owner.workspaceId),
              eq(workspaceNotifications.userId, owner.userId),
              eq(workspaceNotifications.kind, notification.kind),
            ),
          )
          .limit(1);
        const values = {
          ...notification,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        if (existing) {
          await tx
            .update(workspaceNotifications)
            .set(values)
            .where(eq(workspaceNotifications.id, existing.id));
        } else {
          await tx.insert(workspaceNotifications).values({
            workspaceId: owner.workspaceId,
            userId: owner.userId,
            ...values,
          });
        }
      }
    });

    console.log('Synthetic demo workspace data is ready.');
  } finally {
    await client.end();
  }
}

void main();
