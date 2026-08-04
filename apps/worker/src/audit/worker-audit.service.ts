import { Injectable } from '@nestjs/common';
import { workerAuditLogs } from '@workspace/database';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class WorkerAuditService {
  constructor(private readonly database: DatabaseService) {}

  async write(input: {
    workspaceId?: string | null;
    actorUserId?: string | null;
    event: string;
    severity: 'success' | 'warning' | 'error';
    outcome: string;
    queueName?: string;
    jobId?: string | null;
    attempt?: number;
    errorCode?: string | null;
    summary?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    await this.database.db.insert(workerAuditLogs).values({
      workspaceId: input.workspaceId ?? null,
      actorUserId: input.actorUserId ?? null,
      event: input.event,
      severity: input.severity,
      outcome: input.outcome,
      queueName: input.queueName ?? null,
      jobId: input.jobId ?? null,
      attempt: input.attempt ?? null,
      errorCode: input.errorCode ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata ?? {},
    });
  }
}
