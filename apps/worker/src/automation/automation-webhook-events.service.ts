import { Injectable } from '@nestjs/common';
import {
  automationWebhookDeliveries,
  automationWebhooks,
  type Database,
} from '@workspace/database';
import { and, eq } from '@workspace/database/query';
import type { AutomationWebhookEvent } from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AutomationWebhookEventsService {
  constructor(private readonly database: DatabaseService) {}

  async emit(input: AutomationEventInput) {
    await this.database.db.transaction((tx) =>
      this.emitInTransaction(tx, input),
    );
  }

  async emitInTransaction(
    tx: DatabaseTransaction,
    input: AutomationEventInput,
  ) {
    const idempotencyKey = [input.event, input.subjectId, input.occurrenceId]
      .filter(Boolean)
      .join('-');
    const webhooks = await tx
      .select({ id: automationWebhooks.id, events: automationWebhooks.events })
      .from(automationWebhooks)
      .where(
        and(
          eq(automationWebhooks.workspaceId, input.workspaceId),
          eq(automationWebhooks.enabled, true),
        ),
      );
    const subscribed = webhooks.filter((webhook) =>
      webhook.events.includes(input.event),
    );
    if (!subscribed.length) return;
    const now = new Date();
    await tx
      .insert(automationWebhookDeliveries)
      .values(
        subscribed.map((webhook) => ({
          webhookId: webhook.id,
          workspaceId: input.workspaceId,
          event: input.event,
          idempotencyKey,
          payload: {
            id: input.subjectId,
            event: input.event,
            occurredAt: now.toISOString(),
            workspaceId: input.workspaceId,
            data: input.payload,
          },
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing();
  }
}

type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

type AutomationEventInput = {
  workspaceId: string;
  event: AutomationWebhookEvent;
  subjectId: string;
  payload: Record<string, unknown>;
  occurrenceId?: string;
};
