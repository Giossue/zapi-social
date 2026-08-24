import { randomUUID } from 'node:crypto';
import {
  boardColumns,
  boardTasks,
  createDatabase,
  users,
  workspaceMemberships,
  workspaceNotifications,
  workspaces,
  type Database,
} from '@workspace/database';
import { asc, eq } from '@workspace/database/query';
import type { PortalAuthSession } from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { AppException } from '../platform/errors/app-exception';
import { WorkspacePermissionsService } from '../teams/workspace-permissions.service';
import { BoardNotificationsService } from './board-notifications.service';
import { BoardsService } from './boards.service';

const databaseUrl = process.env.TEAMS_TEST_DATABASE_URL;
const isLocalTestDatabase = (() => {
  if (!databaseUrl) return false;
  const url = new URL(databaseUrl);
  return (
    ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/zapi_v2_local'
  );
})();
const describeDatabase = isLocalTestDatabase ? describe : describe.skip;
const rollback = new Error('Rollback Boards integration test.');
const connection = isLocalTestDatabase ? createDatabase(databaseUrl!) : null;

class SilentEmailService {
  readonly sent: string[] = [];

  sendBoardTaskAssigned(input: { email: string }) {
    this.sent.push(input.email);
    return Promise.resolve();
  }
}

const starterNames = { todo: 'Por hacer', doing: 'En curso', done: 'Hecho' };

async function inRollbackTransaction(
  callback: (database: Database) => Promise<void>,
) {
  if (!connection) throw new Error('Local boards database is unavailable.');
  try {
    await connection.db.transaction(async (transaction) => {
      await callback(transaction as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

function sessionFor(
  user: { id: string; email: string; displayName: string },
  workspace: { id: string; name: string; slug: string },
  role: 'owner' | 'admin' | 'member',
): PortalAuthSession {
  return {
    area: 'portal',
    user: { ...user, locale: null },
    workspace: { ...workspace, role },
    workspaces: [{ ...workspace, role }],
  };
}

async function seedWorkspace(database: Database, suffix: string) {
  const [owner] = await database
    .insert(users)
    .values({
      email: `owner-${suffix}-${randomUUID()}@example.test`,
      displayName: 'Owner',
      passwordHash: 'x',
    })
    .returning();
  const [member] = await database
    .insert(users)
    .values({
      email: `member-${suffix}-${randomUUID()}@example.test`,
      displayName: 'Member',
      passwordHash: 'x',
    })
    .returning();
  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: `Boards ${suffix}`,
      slug: `boards-${suffix}-${randomUUID().slice(0, 8)}`,
      ownerUserId: owner.id,
    })
    .returning();
  await database.insert(workspaceMemberships).values([
    { workspaceId: workspace.id, userId: owner.id, role: 'owner' },
    { workspaceId: workspace.id, userId: member.id, role: 'member' },
  ]);

  return {
    member: member,
    memberSession: sessionFor(member, workspace, 'member'),
    owner: owner,
    ownerSession: sessionFor(owner, workspace, 'owner'),
    workspace: workspace,
  };
}

function serviceFor(database: Database) {
  const databaseService = { db: database } as DatabaseService;
  const email = new SilentEmailService();
  return {
    email,
    service: new BoardsService(
      databaseService,
      new WorkspacePermissionsService(databaseService),
      new BoardNotificationsService(
        databaseService,
        email as unknown as EmailService,
      ),
    ),
  };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    if (!(error instanceof AppException)) throw error;
    expect(error.code).toBe(code);
  }
}

describeDatabase('Board lifecycle', () => {
  afterAll(async () => {
    await connection?.client.end({ timeout: 1 });
  });

  it('creates starter columns once and keeps the names the user gave them', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedWorkspace(database, 'starter');
      const { service } = serviceFor(database);

      const first = await service.board(
        scenario.ownerSession,
        {},
        starterNames,
      );
      expect(first.columns.map((column) => column.name)).toEqual([
        'Por hacer',
        'En curso',
        'Hecho',
      ]);
      expect(first.columns.at(-1)?.isTerminal).toBe(true);

      const second = await service.board(
        scenario.ownerSession,
        {},
        {
          todo: 'To do',
          doing: 'Doing',
          done: 'Done',
        },
      );
      expect(second.columns.map((column) => column.name)).toEqual([
        'Por hacer',
        'En curso',
        'Hecho',
      ]);
    });
  });

  it('denies every board endpoint to a member without permissions', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedWorkspace(database, 'denied');
      const { service } = serviceFor(database);

      await expectCode(
        service.board(scenario.memberSession, {}, starterNames),
        'WORKSPACE_PERMISSION_DENIED',
      );
      await expectCode(
        service.createTask(scenario.memberSession, {
          columnId: randomUUID(),
          title: 'x',
        }),
        'WORKSPACE_PERMISSION_DENIED',
      );

      await database
        .update(workspaceMemberships)
        .set({ permissions: ['boards.view'] })
        .where(eq(workspaceMemberships.userId, scenario.member.id));

      await expect(
        service.board(scenario.memberSession, {}, starterNames),
      ).resolves.toMatchObject({
        abilities: { manageTasks: false, manageColumns: false },
      });
      await expectCode(
        service.createTask(scenario.memberSession, {
          columnId: randomUUID(),
          title: 'x',
        }),
        'WORKSPACE_PERMISSION_DENIED',
      );
    });
  });

  it('renumbers the destination column and seals the completion date', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedWorkspace(database, 'move');
      const { service } = serviceFor(database);
      const board = await service.board(
        scenario.ownerSession,
        {},
        starterNames,
      );
      const [todo, , done] = board.columns;

      const created = [];
      for (const title of ['Primera', 'Segunda', 'Tercera']) {
        created.push(
          await service.createTask(scenario.ownerSession, {
            columnId: todo.id,
            title,
          }),
        );
      }
      expect(created.map((task) => task.position)).toEqual([0, 1, 2]);

      await service.moveTask(scenario.ownerSession, created[2].id, {
        columnId: todo.id,
        position: 0,
      });
      const reordered = await database
        .select({ title: boardTasks.title, position: boardTasks.position })
        .from(boardTasks)
        .where(eq(boardTasks.columnId, todo.id))
        .orderBy(asc(boardTasks.position));
      expect(reordered).toEqual([
        { title: 'Tercera', position: 0 },
        { title: 'Primera', position: 1 },
        { title: 'Segunda', position: 2 },
      ]);

      const finished = await service.moveTask(
        scenario.ownerSession,
        created[0].id,
        { columnId: done.id, position: 0 },
      );
      expect(finished.completedAt).not.toBeNull();
      const reopened = await service.moveTask(
        scenario.ownerSession,
        created[0].id,
        { columnId: todo.id, position: 0 },
      );
      expect(reopened.completedAt).toBeNull();
    });
  });

  it('notifies the assignee but never the person doing the assigning', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedWorkspace(database, 'notify');
      const { email, service } = serviceFor(database);
      const board = await service.board(
        scenario.ownerSession,
        {},
        starterNames,
      );
      const column = board.columns[0];

      await service.createTask(scenario.ownerSession, {
        columnId: column.id,
        title: 'Para el owner',
        assigneeUserId: scenario.owner.id,
      });
      await service.createTask(scenario.ownerSession, {
        columnId: column.id,
        title: 'Para el miembro',
        assigneeUserId: scenario.member.id,
      });

      const notifications = await database
        .select({
          userId: workspaceNotifications.userId,
          kind: workspaceNotifications.kind,
          payload: workspaceNotifications.payload,
        })
        .from(workspaceNotifications)
        .where(eq(workspaceNotifications.workspaceId, scenario.workspace.id));

      expect(notifications).toEqual([
        {
          userId: scenario.member.id,
          kind: 'board.task_assigned',
          payload: { title: 'Para el miembro', actor: 'Owner' },
        },
      ]);
      expect(email.sent).toEqual([scenario.member.email]);
    });
  });

  it('refuses an assignee from outside the workspace and a column with cards', async () => {
    await inRollbackTransaction(async (database) => {
      const scenario = await seedWorkspace(database, 'guards');
      const other = await seedWorkspace(database, 'other');
      const { service } = serviceFor(database);
      const board = await service.board(
        scenario.ownerSession,
        {},
        starterNames,
      );
      const column = board.columns[0];

      await expectCode(
        service.createTask(scenario.ownerSession, {
          columnId: column.id,
          title: 'Ajena',
          assigneeUserId: other.owner.id,
        }),
        'BOARD_ASSIGNEE_INVALID',
      );

      await service.createTask(scenario.ownerSession, {
        columnId: column.id,
        title: 'Ocupa la columna',
      });
      await expectCode(
        service.deleteColumn(scenario.ownerSession, column.id),
        'BOARD_COLUMN_NOT_EMPTY',
      );

      const empty = await database
        .select({ id: boardColumns.id })
        .from(boardColumns)
        .where(eq(boardColumns.workspaceId, scenario.workspace.id))
        .orderBy(asc(boardColumns.position));
      await expect(
        service.deleteColumn(scenario.ownerSession, empty[1].id),
      ).resolves.toBeUndefined();
    });
  });
});
