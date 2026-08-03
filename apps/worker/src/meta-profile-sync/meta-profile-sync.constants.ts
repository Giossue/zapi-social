export const META_PROFILE_SCHEDULE_QUEUE = 'meta-profile-schedule';
export const META_PROFILE_SYNC_QUEUE = 'meta-profile-sync';
export const META_PROFILE_SCHEDULE_JOB = 'schedule-due-profiles';
export const META_PROFILE_SYNC_JOB = 'sync-profile';

export const META_PROFILE_SYNC_INTERVAL_MS = 5 * 60 * 1_000;
export const META_PROFILE_SYNC_BATCH_SIZE = 25;
export const META_PROFILE_SYNC_CONCURRENCY = 2;
export const META_PROFILE_SYNC_DUE_INTERVAL_MS = 24 * 60 * 60 * 1_000;

export type MetaProfileSyncJobData = {
  accountId: string;
};
