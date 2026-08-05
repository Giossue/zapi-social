export const RSS_SCHEDULE_RUN_JOB = 'process-rss-schedule-run';
export const RSS_SCHEDULE_RUN_QUEUE = 'rss-schedule-runs';

export type RssScheduleRunJobData = {
  ignoreHistory: boolean;
  rssScheduleId: string;
  rssScheduleRunId: string;
  workspaceId: string;
};
