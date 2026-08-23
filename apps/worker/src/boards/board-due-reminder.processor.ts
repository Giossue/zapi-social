import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import {
  BOARD_DUE_REMINDER_BATCH_SIZE,
  BOARD_DUE_REMINDER_JOB,
  BOARD_DUE_REMINDER_QUEUE,
} from './boards.constants';

/**
 * Avisa al responsable de una tarea que vence mañana.
 *
 * El estado de negocio vive en `board_tasks.due_date`, no en el job: si el
 * worker se cae, el barrido siguiente vuelve a encontrar la misma tarea. La
 * repetición no duplica avisos porque el `insert` descarta la tarea que ya
 * tiene su aviso de vencimiento.
 */
@Injectable()
@Processor(BOARD_DUE_REMINDER_QUEUE)
export class BoardDueReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(BoardDueReminderProcessor.name);

  constructor(private readonly database: DatabaseService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== BOARD_DUE_REMINDER_JOB) return;

    const inserted = await this.database.client<{ id: string }[]>`
      insert into workspace_notifications (workspace_id, user_id, kind, payload, url)
      select
        tasks.workspace_id,
        tasks.assignee_user_id,
        'board.task_due_soon',
        jsonb_build_object('taskId', tasks.id::text, 'title', tasks.title),
        '/portal/boards/tasks?task=' || tasks.id::text
      from board_tasks as tasks
      where tasks.assignee_user_id is not null
        and tasks.archived_at is null
        and tasks.completed_at is null
        and tasks.due_date is not null
        and tasks.due_date <= current_date + 1
        and tasks.due_date >= current_date
        and not exists (
          select 1
          from workspace_notifications as sent
          where sent.kind = 'board.task_due_soon'
            and sent.payload ->> 'taskId' = tasks.id::text
        )
      order by tasks.due_date
      limit ${BOARD_DUE_REMINDER_BATCH_SIZE}
      returning id
    `;

    if (inserted.length) {
      this.logger.log(`Board due reminders queued: ${inserted.length}`);
    }
  }
}
