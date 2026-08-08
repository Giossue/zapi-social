export const AI_REQUEST_JOB = 'process-ai-request';
export const AI_REQUEST_QUEUE = 'ai-requests';
export const AI_SCHEDULE_DISPATCH_JOB = 'dispatch-due-ai-schedules';
export const AI_SCHEDULE_DISPATCH_QUEUE = 'ai-schedule-dispatch';
export const AI_SCHEDULE_DISPATCH_INTERVAL_MS = 60_000;

export type AiRequestJobData = {
  aiRequestId: string;
  workspaceId: string;
};

export type AiScheduleDispatchJobData = Record<string, never>;
