import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { sql } from '@workspace/database/query';
import { type Job } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import {
  PLAN_TRANSITIONS_BATCH_SIZE,
  PLAN_TRANSITIONS_JOB,
  PLAN_TRANSITIONS_QUEUE,
} from './plan-transitions.constants';

@Injectable()
@Processor(PLAN_TRANSITIONS_QUEUE)
export class PlanTransitionsProcessor extends WorkerHost {
  private readonly logger = new Logger(PlanTransitionsProcessor.name);

  constructor(private readonly database: DatabaseService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== PLAN_TRANSITIONS_JOB) return;

    const transitioned = await this.database.db.execute(
      sql<{ id: string; workspaceId: string; planId: string }>`
      with due as (
        select
          assignments.id,
          assignments.next_plan_id,
          coalesce(target_plan.id, default_plan.id) as resolved_plan_id
        from workspace_plan_assignments as assignments
        left join plans as target_plan
          on target_plan.id = assignments.next_plan_id
          and target_plan.status = 'active'
        left join lateral (
          select fallback.id
          from plans as fallback
          where fallback.is_default_signup = true
            and fallback.status = 'active'
          order by fallback.position, fallback.created_at
          limit 1
        ) as default_plan on true
        where assignments.next_plan_id is not null
          and exists (
            select 1
            from billing_subscriptions as subscriptions
            where subscriptions.workspace_id = assignments.workspace_id
              and subscriptions.plan_id = assignments.plan_id
              and subscriptions.current_period_ends_at is not null
              and subscriptions.current_period_ends_at <= now()
          )
        order by assignments.updated_at, assignments.id
        limit ${PLAN_TRANSITIONS_BATCH_SIZE}
      )
      update workspace_plan_assignments as assignments
      set
        plan_id = coalesce(due.resolved_plan_id, assignments.plan_id),
        next_plan_id = null,
        source = case
          when due.resolved_plan_id is null then assignments.source
          else 'admin'
        end,
        updated_by_user_id = null,
        updated_at = now()
      from due
      where assignments.id = due.id
        and assignments.next_plan_id = due.next_plan_id
      returning
        assignments.id,
        assignments.workspace_id as "workspaceId",
        assignments.plan_id as "planId"
      `,
    );

    if (transitioned.length) {
      this.logger.log(
        `Scheduled plan transitions activated: ${transitioned.length}`,
      );
    }
  }
}
