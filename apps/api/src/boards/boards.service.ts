import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  boardColumns,
  boardLabels,
  boardTaskAttachments,
  boardTaskComments,
  boardTaskLabels,
  boardTasks,
  fileAssets,
  users,
  workspaceMemberships,
} from '@workspace/database';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from '@workspace/database/query';
import type { SQL } from '@workspace/database/query';
import {
  type BoardAbilities,
  type BoardQuery,
  type BoardResponse,
  type BoardTask,
  type BoardTaskDetail,
  type PortalAuthSession,
  boardQuerySchema,
  createBoardLabelSchema,
  createBoardTaskAttachmentSchema,
  createBoardTaskCommentSchema,
  createBoardColumnSchema,
  createBoardTaskSchema,
  moveBoardTaskSchema,
  reorderBoardColumnsSchema,
  updateBoardColumnSchema,
  updateBoardTaskSchema,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { WorkspacePermissionsService } from '../teams/workspace-permissions.service';
import { BoardNotificationsService } from './board-notifications.service';

/**
 * Columnas con las que arranca un espacio que abre el tablero por primera vez.
 * El nombre lo pone la interfaz al crearlas, porque la API no traduce; aquí
 * solo vive la forma.
 */
const starterColumns = [
  { key: 'todo', isTerminal: false, color: '#64748b' },
  { key: 'doing', isTerminal: false, color: '#2563eb' },
  { key: 'done', isTerminal: true, color: '#16a34a' },
] as const;

type Transaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

@Injectable()
export class BoardsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly permissions: WorkspacePermissionsService,
    private readonly notifications: BoardNotificationsService,
  ) {}

  async board(
    session: PortalAuthSession,
    rawQuery: unknown,
    starterNames?: Record<string, string>,
  ): Promise<BoardResponse> {
    await this.permissions.require(session, 'boards.view');
    const parsed = boardQuerySchema.safeParse(rawQuery ?? {});
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    await this.ensureColumns(session, starterNames);

    const [abilities, columns, labels, members] = await Promise.all([
      this.abilities(session),
      this.database.db
        .select()
        .from(boardColumns)
        .where(eq(boardColumns.workspaceId, session.workspace.id))
        .orderBy(asc(boardColumns.position)),
      this.database.db
        .select()
        .from(boardLabels)
        .where(eq(boardLabels.workspaceId, session.workspace.id))
        .orderBy(asc(boardLabels.name)),
      this.members(session),
    ]);

    const tasks = await this.tasks(session, parsed.data);

    return {
      abilities,
      currentUserId: session.user.id,
      columns: columns.map((column) => ({
        id: column.id,
        name: column.name,
        position: column.position,
        color: column.color,
        isTerminal: column.isTerminal,
        wipLimit: column.wipLimit,
      })),
      labels: labels.map(({ id, name, color }) => ({ id, name, color })),
      members,
      tasks,
    };
  }

  async createColumn(session: PortalAuthSession, input: unknown) {
    await this.permissions.require(session, 'boards.manage_columns');
    const parsed = createBoardColumnSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    return this.database.db.transaction(async (tx) => {
      const [last] = await tx
        .select({ position: boardColumns.position })
        .from(boardColumns)
        .where(eq(boardColumns.workspaceId, session.workspace.id))
        .orderBy(desc(boardColumns.position))
        .limit(1);
      const [column] = await tx
        .insert(boardColumns)
        .values({
          workspaceId: session.workspace.id,
          name: parsed.data.name,
          color: parsed.data.color,
          isTerminal: parsed.data.isTerminal,
          wipLimit: parsed.data.wipLimit,
          position: (last?.position ?? -1) + 1,
        })
        .returning();
      if (!column)
        throw new AppException('REQUEST_FAILED', HttpStatus.CONFLICT);
      await this.audit(tx, session, 'board.column_created', column.id);
      return column;
    });
  }

  async updateColumn(
    session: PortalAuthSession,
    columnId: string,
    input: unknown,
  ) {
    await this.permissions.require(session, 'boards.manage_columns');
    const parsed = updateBoardColumnSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const [column] = await this.database.db
      .update(boardColumns)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(boardColumns.id, columnId),
          eq(boardColumns.workspaceId, session.workspace.id),
        ),
      )
      .returning();
    if (!column)
      throw new AppException('BOARD_COLUMN_NOT_FOUND', HttpStatus.NOT_FOUND);
    return column;
  }

  async reorderColumns(session: PortalAuthSession, input: unknown) {
    await this.permissions.require(session, 'boards.manage_columns');
    const parsed = reorderBoardColumnsSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    await this.database.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: boardColumns.id })
        .from(boardColumns)
        .where(eq(boardColumns.workspaceId, session.workspace.id))
        .for('update');
      const known = new Set(existing.map(({ id }) => id));
      // Reordenar una lista parcial dejaría huecos: se exige el tablero entero.
      if (
        parsed.data.columnIds.length !== known.size ||
        !parsed.data.columnIds.every((id) => known.has(id))
      ) {
        throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
      }
      for (const [index, id] of parsed.data.columnIds.entries()) {
        await tx
          .update(boardColumns)
          .set({ position: index, updatedAt: new Date() })
          .where(
            and(
              eq(boardColumns.id, id),
              eq(boardColumns.workspaceId, session.workspace.id),
            ),
          );
      }
    });
  }

  async deleteColumn(session: PortalAuthSession, columnId: string) {
    await this.permissions.require(session, 'boards.manage_columns');
    await this.database.db.transaction(async (tx) => {
      const [tasks] = await tx
        .select({ total: count() })
        .from(boardTasks)
        .where(
          and(
            eq(boardTasks.columnId, columnId),
            eq(boardTasks.workspaceId, session.workspace.id),
            isNull(boardTasks.archivedAt),
          ),
        );
      // Borrar arrastrando tarjetas perdería trabajo sin avisar.
      if (Number(tasks?.total ?? 0) > 0)
        throw new AppException('BOARD_COLUMN_NOT_EMPTY', HttpStatus.CONFLICT);
      const deleted = await tx
        .delete(boardColumns)
        .where(
          and(
            eq(boardColumns.id, columnId),
            eq(boardColumns.workspaceId, session.workspace.id),
          ),
        )
        .returning({ id: boardColumns.id });
      if (!deleted.length)
        throw new AppException('BOARD_COLUMN_NOT_FOUND', HttpStatus.NOT_FOUND);
      await this.audit(tx, session, 'board.column_deleted', columnId);
    });
  }

  async createTask(session: PortalAuthSession, input: unknown) {
    await this.permissions.require(session, 'boards.manage_tasks');
    const parsed = createBoardTaskSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const created = await this.database.db.transaction(async (tx) => {
      const column = await this.requireColumn(
        tx,
        session,
        parsed.data.columnId,
      );
      await this.assertAssignee(tx, session, parsed.data.assigneeUserId);
      await this.assertLabels(tx, session, parsed.data.labelIds);
      const [last] = await tx
        .select({ position: boardTasks.position })
        .from(boardTasks)
        .where(
          and(
            eq(boardTasks.workspaceId, session.workspace.id),
            eq(boardTasks.columnId, column.id),
          ),
        )
        .orderBy(desc(boardTasks.position))
        .limit(1);
      const now = new Date();
      const [task] = await tx
        .insert(boardTasks)
        .values({
          workspaceId: session.workspace.id,
          columnId: column.id,
          createdByUserId: session.user.id,
          assigneeUserId: parsed.data.assigneeUserId,
          title: parsed.data.title,
          description: parsed.data.description,
          priority: parsed.data.priority,
          dueDate: parsed.data.dueDate,
          progress: parsed.data.progress,
          position: (last?.position ?? -1) + 1,
          completedAt: column.isTerminal ? now : null,
          publishingPostId: parsed.data.publishingPostId,
        })
        .returning();
      if (!task) throw new AppException('REQUEST_FAILED', HttpStatus.CONFLICT);
      await this.replaceLabels(tx, session, task.id, parsed.data.labelIds);
      await this.audit(tx, session, 'board.task_created', task.id);
      return task;
    });

    await this.notifications.taskAssigned(session, created);
    return this.taskDetail(session, created.id);
  }

  async updateTask(session: PortalAuthSession, taskId: string, input: unknown) {
    await this.permissions.require(session, 'boards.manage_tasks');
    const parsed = updateBoardTaskSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const { task, assigneeChanged } = await this.database.db.transaction(
      async (tx) => {
        const current = await this.requireTask(tx, session, taskId);
        if (parsed.data.assigneeUserId !== undefined)
          await this.assertAssignee(tx, session, parsed.data.assigneeUserId);
        if (parsed.data.labelIds !== undefined) {
          await this.assertLabels(tx, session, parsed.data.labelIds);
          await this.replaceLabels(tx, session, taskId, parsed.data.labelIds);
        }
        const { labelIds: _labelIds, ...columnsToSet } = parsed.data;
        const [updated] = await tx
          .update(boardTasks)
          .set({ ...columnsToSet, updatedAt: new Date() })
          .where(
            and(
              eq(boardTasks.id, taskId),
              eq(boardTasks.workspaceId, session.workspace.id),
            ),
          )
          .returning();
        if (!updated)
          throw new AppException('REQUEST_FAILED', HttpStatus.CONFLICT);
        await this.audit(tx, session, 'board.task_updated', taskId);
        return {
          task: updated,
          assigneeChanged:
            parsed.data.assigneeUserId !== undefined &&
            parsed.data.assigneeUserId !== current.assigneeUserId,
        };
      },
    );

    if (assigneeChanged) await this.notifications.taskAssigned(session, task);
    return this.taskDetail(session, taskId);
  }

  async moveTask(session: PortalAuthSession, taskId: string, input: unknown) {
    await this.permissions.require(session, 'boards.manage_tasks');
    const parsed = moveBoardTaskSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    await this.database.db.transaction(async (tx) => {
      const task = await this.requireTask(tx, session, taskId);
      const column = await this.requireColumn(
        tx,
        session,
        parsed.data.columnId,
      );

      // Se renumera la columna entera dentro de la transacción: mover con un
      // desplazamiento dejaría el orden incoherente si dos personas arrastran a
      // la vez.
      const siblings = await tx
        .select({ id: boardTasks.id })
        .from(boardTasks)
        .where(
          and(
            eq(boardTasks.workspaceId, session.workspace.id),
            eq(boardTasks.columnId, column.id),
          ),
        )
        .orderBy(asc(boardTasks.position))
        .for('update');
      const order = siblings.map(({ id }) => id).filter((id) => id !== taskId);
      order.splice(Math.min(parsed.data.position, order.length), 0, taskId);

      const now = new Date();
      await tx
        .update(boardTasks)
        .set({
          columnId: column.id,
          // Volver de la columna terminal a una intermedia deshace el sello: la
          // tarea vuelve a estar en curso.
          completedAt: column.isTerminal ? (task.completedAt ?? now) : null,
          updatedAt: now,
        })
        .where(eq(boardTasks.id, taskId));
      for (const [index, id] of order.entries()) {
        await tx
          .update(boardTasks)
          .set({ position: index, updatedAt: now })
          .where(
            and(
              eq(boardTasks.id, id),
              eq(boardTasks.workspaceId, session.workspace.id),
            ),
          );
      }
      await this.audit(tx, session, 'board.task_moved', taskId);
    });

    return this.taskDetail(session, taskId);
  }

  async archiveTask(session: PortalAuthSession, taskId: string) {
    await this.permissions.require(session, 'boards.manage_tasks');
    const [task] = await this.database.db
      .update(boardTasks)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(boardTasks.id, taskId),
          eq(boardTasks.workspaceId, session.workspace.id),
          isNull(boardTasks.archivedAt),
        ),
      )
      .returning({ id: boardTasks.id });
    if (!task)
      throw new AppException('BOARD_TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  async deleteTask(session: PortalAuthSession, taskId: string) {
    await this.permissions.require(session, 'boards.delete_tasks');
    await this.database.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(boardTasks)
        .where(
          and(
            eq(boardTasks.id, taskId),
            eq(boardTasks.workspaceId, session.workspace.id),
          ),
        )
        .returning({ id: boardTasks.id });
      if (!deleted.length)
        throw new AppException('BOARD_TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
      await this.audit(tx, session, 'board.task_deleted', taskId);
    });
  }

  async task(session: PortalAuthSession, taskId: string) {
    await this.permissions.require(session, 'boards.view');
    return this.taskDetail(session, taskId);
  }

  async addComment(session: PortalAuthSession, taskId: string, input: unknown) {
    await this.permissions.require(session, 'boards.manage_tasks');
    const parsed = createBoardTaskCommentSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const task = await this.database.db.transaction(async (tx) => {
      const current = await this.requireTask(tx, session, taskId);
      await tx.insert(boardTaskComments).values({
        taskId,
        workspaceId: session.workspace.id,
        authorUserId: session.user.id,
        body: parsed.data.body,
      });
      return current;
    });

    await this.notifications.taskCommented(session, task);
    return this.taskDetail(session, taskId);
  }

  async addAttachment(
    session: PortalAuthSession,
    taskId: string,
    input: unknown,
  ) {
    await this.permissions.require(session, 'boards.manage_tasks');
    const parsed = createBoardTaskAttachmentSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    await this.database.db.transaction(async (tx) => {
      await this.requireTask(tx, session, taskId);
      const [asset] = await tx
        .select({ id: fileAssets.id })
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.id, parsed.data.fileAssetId),
            eq(fileAssets.workspaceId, session.workspace.id),
          ),
        )
        .limit(1);
      if (!asset)
        throw new AppException('BOARD_ASSET_NOT_FOUND', HttpStatus.NOT_FOUND);
      await tx
        .insert(boardTaskAttachments)
        .values({
          taskId,
          fileAssetId: asset.id,
          workspaceId: session.workspace.id,
          createdByUserId: session.user.id,
        })
        .onConflictDoNothing();
    });

    return this.taskDetail(session, taskId);
  }

  async removeAttachment(
    session: PortalAuthSession,
    taskId: string,
    attachmentId: string,
  ) {
    await this.permissions.require(session, 'boards.manage_tasks');
    const removed = await this.database.db
      .delete(boardTaskAttachments)
      .where(
        and(
          eq(boardTaskAttachments.id, attachmentId),
          eq(boardTaskAttachments.taskId, taskId),
          eq(boardTaskAttachments.workspaceId, session.workspace.id),
        ),
      )
      .returning({ id: boardTaskAttachments.id });
    if (!removed.length)
      throw new AppException('BOARD_ASSET_NOT_FOUND', HttpStatus.NOT_FOUND);
    return this.taskDetail(session, taskId);
  }

  async createLabel(session: PortalAuthSession, input: unknown) {
    await this.permissions.require(session, 'boards.manage_columns');
    const parsed = createBoardLabelSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const [label] = await this.database.db
      .insert(boardLabels)
      .values({
        workspaceId: session.workspace.id,
        name: parsed.data.name,
        color: parsed.data.color,
      })
      .onConflictDoNothing()
      .returning();
    if (!label)
      throw new AppException('BOARD_LABEL_EXISTS', HttpStatus.CONFLICT);
    return { id: label.id, name: label.name, color: label.color };
  }

  async deleteLabel(session: PortalAuthSession, labelId: string) {
    await this.permissions.require(session, 'boards.manage_columns');
    const removed = await this.database.db
      .delete(boardLabels)
      .where(
        and(
          eq(boardLabels.id, labelId),
          eq(boardLabels.workspaceId, session.workspace.id),
        ),
      )
      .returning({ id: boardLabels.id });
    if (!removed.length)
      throw new AppException('BOARD_LABEL_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  private async abilities(session: PortalAuthSession): Promise<BoardAbilities> {
    const [manageTasks, manageColumns, deleteTasks] = await Promise.all([
      this.permissions.allows(session, 'boards.manage_tasks'),
      this.permissions.allows(session, 'boards.manage_columns'),
      this.permissions.allows(session, 'boards.delete_tasks'),
    ]);
    return { manageTasks, manageColumns, deleteTasks };
  }

  /**
   * Crea las columnas de arranque la primera vez. Los nombres los manda la
   * interfaz en el idioma activo: desde ese momento son datos del usuario y no
   * vuelven a cambiar aunque cambie de idioma.
   */
  private async ensureColumns(
    session: PortalAuthSession,
    starterNames?: Record<string, string>,
  ) {
    const [existing] = await this.database.db
      .select({ total: count() })
      .from(boardColumns)
      .where(eq(boardColumns.workspaceId, session.workspace.id));
    if (Number(existing?.total ?? 0) > 0) return;

    await this.database.db
      .insert(boardColumns)
      .values(
        starterColumns.map((column, index) => ({
          workspaceId: session.workspace.id,
          name: starterNames?.[column.key]?.slice(0, 60) || column.key,
          position: index,
          color: column.color,
          isTerminal: column.isTerminal,
        })),
      )
      .onConflictDoNothing();
  }

  private async members(session: PortalAuthSession) {
    const rows = await this.database.db
      .select({ id: users.id, name: users.displayName })
      .from(workspaceMemberships)
      .innerJoin(users, eq(workspaceMemberships.userId, users.id))
      .where(
        and(
          eq(workspaceMemberships.workspaceId, session.workspace.id),
          eq(workspaceMemberships.status, 'active'),
        ),
      )
      .orderBy(asc(users.displayName));
    return rows;
  }

  private async tasks(
    session: PortalAuthSession,
    query: BoardQuery,
  ): Promise<BoardTask[]> {
    const filters: SQL[] = [
      eq(boardTasks.workspaceId, session.workspace.id),
      isNull(boardTasks.archivedAt),
    ];
    if (query.q) {
      const pattern = `%${query.q}%`;
      const search = or(
        ilike(boardTasks.title, pattern),
        ilike(boardTasks.description, pattern),
      );
      if (search) filters.push(search);
    }
    if (query.assigneeId) {
      filters.push(
        eq(
          boardTasks.assigneeUserId,
          query.assigneeId === 'me' ? session.user.id : query.assigneeId,
        ),
      );
    }
    if (query.priority) filters.push(eq(boardTasks.priority, query.priority));

    const assignee = users;
    const rows = await this.database.db
      .select({
        task: boardTasks,
        assigneeName: assignee.displayName,
      })
      .from(boardTasks)
      .leftJoin(assignee, eq(boardTasks.assigneeUserId, assignee.id))
      .where(and(...filters))
      .orderBy(asc(boardTasks.position));

    const taskIds = rows.map(({ task }) => task.id);
    const [labelRows, commentCounts, attachmentCounts, authors] =
      await Promise.all([
        this.labelsFor(taskIds),
        this.commentCountsFor(taskIds),
        this.attachmentCountsFor(taskIds),
        this.authorsFor(rows.map(({ task }) => task.createdByUserId)),
      ]);

    const filtered = query.labelId
      ? rows.filter(({ task }) =>
          (labelRows.get(task.id) ?? []).includes(query.labelId!),
        )
      : rows;

    return filtered.map(({ task, assigneeName }) => ({
      id: task.id,
      columnId: task.columnId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      progress: task.progress,
      position: task.position,
      assignee:
        task.assigneeUserId && assigneeName
          ? { id: task.assigneeUserId, name: assigneeName }
          : null,
      createdBy: authors.get(task.createdByUserId) ?? null,
      labelIds: labelRows.get(task.id) ?? [],
      commentCount: commentCounts.get(task.id) ?? 0,
      attachmentCount: attachmentCounts.get(task.id) ?? 0,
      completedAt: task.completedAt?.toISOString() ?? null,
      publishingPostId: task.publishingPostId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));
  }

  private async taskDetail(
    session: PortalAuthSession,
    taskId: string,
  ): Promise<BoardTaskDetail> {
    const tasks = await this.tasks(session, {});
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task)
      throw new AppException('BOARD_TASK_NOT_FOUND', HttpStatus.NOT_FOUND);

    const [comments, attachments] = await Promise.all([
      this.database.db
        .select({
          id: boardTaskComments.id,
          body: boardTaskComments.body,
          createdAt: boardTaskComments.createdAt,
          authorId: users.id,
          authorName: users.displayName,
        })
        .from(boardTaskComments)
        .leftJoin(users, eq(boardTaskComments.authorUserId, users.id))
        .where(
          and(
            eq(boardTaskComments.taskId, taskId),
            eq(boardTaskComments.workspaceId, session.workspace.id),
          ),
        )
        .orderBy(asc(boardTaskComments.createdAt)),
      this.database.db
        .select({
          id: boardTaskAttachments.id,
          fileAssetId: fileAssets.id,
          name: fileAssets.name,
          sizeBytes: fileAssets.sizeBytes,
          mimeType: fileAssets.mimeType,
          createdAt: boardTaskAttachments.createdAt,
        })
        .from(boardTaskAttachments)
        .innerJoin(
          fileAssets,
          eq(boardTaskAttachments.fileAssetId, fileAssets.id),
        )
        .where(
          and(
            eq(boardTaskAttachments.taskId, taskId),
            eq(boardTaskAttachments.workspaceId, session.workspace.id),
          ),
        )
        .orderBy(asc(boardTaskAttachments.createdAt)),
    ]);

    return {
      ...task,
      comments: comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        author:
          comment.authorId && comment.authorName
            ? { id: comment.authorId, name: comment.authorName }
            : null,
        createdAt: comment.createdAt.toISOString(),
      })),
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        fileAssetId: attachment.fileAssetId,
        name: attachment.name,
        sizeBytes: Number(attachment.sizeBytes),
        mimeType: attachment.mimeType,
        createdAt: attachment.createdAt.toISOString(),
      })),
    };
  }

  private async labelsFor(taskIds: string[]) {
    const map = new Map<string, string[]>();
    if (!taskIds.length) return map;
    const rows = await this.database.db
      .select({
        taskId: boardTaskLabels.taskId,
        labelId: boardTaskLabels.labelId,
      })
      .from(boardTaskLabels)
      .where(inArray(boardTaskLabels.taskId, taskIds));
    for (const row of rows) {
      map.set(row.taskId, [...(map.get(row.taskId) ?? []), row.labelId]);
    }
    return map;
  }

  private async commentCountsFor(taskIds: string[]) {
    const map = new Map<string, number>();
    if (!taskIds.length) return map;
    const rows = await this.database.db
      .select({ taskId: boardTaskComments.taskId, total: count() })
      .from(boardTaskComments)
      .where(inArray(boardTaskComments.taskId, taskIds))
      .groupBy(boardTaskComments.taskId);
    for (const row of rows) map.set(row.taskId, Number(row.total));
    return map;
  }

  private async attachmentCountsFor(taskIds: string[]) {
    const map = new Map<string, number>();
    if (!taskIds.length) return map;
    const rows = await this.database.db
      .select({ taskId: boardTaskAttachments.taskId, total: count() })
      .from(boardTaskAttachments)
      .where(inArray(boardTaskAttachments.taskId, taskIds))
      .groupBy(boardTaskAttachments.taskId);
    for (const row of rows) map.set(row.taskId, Number(row.total));
    return map;
  }

  private async authorsFor(userIds: string[]) {
    const map = new Map<string, { id: string; name: string }>();
    const unique = [...new Set(userIds)];
    if (!unique.length) return map;
    const rows = await this.database.db
      .select({ id: users.id, name: users.displayName })
      .from(users)
      .where(inArray(users.id, unique));
    for (const row of rows) map.set(row.id, row);
    return map;
  }

  private async requireColumn(
    tx: Transaction,
    session: PortalAuthSession,
    columnId: string,
  ) {
    const [column] = await tx
      .select()
      .from(boardColumns)
      .where(
        and(
          eq(boardColumns.id, columnId),
          eq(boardColumns.workspaceId, session.workspace.id),
        ),
      )
      .limit(1);
    if (!column)
      throw new AppException('BOARD_COLUMN_NOT_FOUND', HttpStatus.NOT_FOUND);
    return column;
  }

  private async requireTask(
    tx: Transaction,
    session: PortalAuthSession,
    taskId: string,
  ) {
    const [task] = await tx
      .select()
      .from(boardTasks)
      .where(
        and(
          eq(boardTasks.id, taskId),
          eq(boardTasks.workspaceId, session.workspace.id),
        ),
      )
      .for('update')
      .limit(1);
    if (!task)
      throw new AppException('BOARD_TASK_NOT_FOUND', HttpStatus.NOT_FOUND);
    return task;
  }

  /** El responsable tiene que ser miembro activo del mismo espacio. */
  private async assertAssignee(
    tx: Transaction,
    session: PortalAuthSession,
    assigneeUserId: string | null | undefined,
  ) {
    if (!assigneeUserId) return;
    const [membership] = await tx
      .select({ id: workspaceMemberships.id })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, session.workspace.id),
          eq(workspaceMemberships.userId, assigneeUserId),
          eq(workspaceMemberships.status, 'active'),
        ),
      )
      .limit(1);
    if (!membership)
      throw new AppException('BOARD_ASSIGNEE_INVALID', HttpStatus.FORBIDDEN);
  }

  private async assertLabels(
    tx: Transaction,
    session: PortalAuthSession,
    labelIds: string[],
  ) {
    if (!labelIds.length) return;
    const rows = await tx
      .select({ id: boardLabels.id })
      .from(boardLabels)
      .where(
        and(
          eq(boardLabels.workspaceId, session.workspace.id),
          inArray(boardLabels.id, labelIds),
        ),
      );
    if (rows.length !== new Set(labelIds).size)
      throw new AppException('BOARD_LABEL_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  private async replaceLabels(
    tx: Transaction,
    session: PortalAuthSession,
    taskId: string,
    labelIds: string[],
  ) {
    await tx.delete(boardTaskLabels).where(eq(boardTaskLabels.taskId, taskId));
    if (!labelIds.length) return;
    await tx.insert(boardTaskLabels).values(
      [...new Set(labelIds)].map((labelId) => ({
        taskId,
        labelId,
        workspaceId: session.workspace.id,
      })),
    );
  }

  private async audit(
    tx: Transaction,
    session: PortalAuthSession,
    event: string,
    subjectId: string,
  ) {
    await tx.insert(apiAuditLogs).values({
      workspaceId: session.workspace.id,
      actorUserId: session.user.id,
      event,
      subjectType: 'board_task',
      subjectId,
      summary: event,
      metadata: {},
    });
  }
}
