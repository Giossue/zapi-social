import { Injectable, Logger } from '@nestjs/common';
import { users, workspaceNotifications } from '@workspace/database';
import { eq } from '@workspace/database/query';
import type { PortalAuthSession } from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';

type TaskRow = {
  id: string;
  title: string;
  assigneeUserId: string | null;
  workspaceId: string;
};

@Injectable()
export class BoardNotificationsService {
  private readonly logger = new Logger(BoardNotificationsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly email: EmailService,
  ) {}

  async taskAssigned(session: PortalAuthSession, task: TaskRow) {
    if (!task.assigneeUserId || task.assigneeUserId === session.user.id) return;

    await this.record(task.assigneeUserId, task, 'board.task_assigned', {
      title: task.title,
      actor: session.user.displayName,
    });

    const [assignee] = await this.database.db
      .select({ email: users.email, name: users.displayName })
      .from(users)
      .where(eq(users.id, task.assigneeUserId))
      .limit(1);
    if (!assignee?.email) return;

    void this.email
      .sendBoardTaskAssigned({
        email: assignee.email,
        memberName: assignee.name,
        actorName: session.user.displayName,
        taskTitle: task.title,
        workspaceName: session.workspace.name,
        taskUrl: this.taskUrl(task.id),
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Board assignment email failed: task=${task.id} ${String(error)}`,
        );
      });
  }

  async taskCommented(session: PortalAuthSession, task: TaskRow) {
    if (!task.assigneeUserId || task.assigneeUserId === session.user.id) return;
    await this.record(task.assigneeUserId, task, 'board.task_commented', {
      title: task.title,
      actor: session.user.displayName,
    });
  }

  private async record(
    userId: string,
    task: TaskRow,
    kind: string,
    payload: Record<string, string>,
  ) {
    await this.database.db.insert(workspaceNotifications).values({
      workspaceId: task.workspaceId,
      userId,
      kind,
      payload,
      url: this.taskUrl(task.id),
    });
  }

  private taskUrl(taskId: string) {
    return `/portal/tasks?task=${taskId}`;
  }
}
