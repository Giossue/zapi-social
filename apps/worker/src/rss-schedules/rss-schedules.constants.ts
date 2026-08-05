export const RSS_SCHEDULE_DISPATCH_INTERVAL_MS = 60_000;
export const RSS_SCHEDULE_DISPATCH_JOB = 'dispatch-due-rss-schedules';
export const RSS_SCHEDULE_DISPATCH_QUEUE = 'rss-schedule-dispatch';
export const RSS_SCHEDULE_RUN_CONCURRENCY = 2;
export const RSS_SCHEDULE_RUN_JOB = 'process-rss-schedule-run';
export const RSS_SCHEDULE_RUN_QUEUE = 'rss-schedule-runs';

export type RssScheduleDispatchJobData = Record<string, never>;

export type RssScheduleRunJobData = {
  ignoreHistory: boolean;
  rssScheduleId: string;
  rssScheduleRunId: string;
  workspaceId: string;
};
