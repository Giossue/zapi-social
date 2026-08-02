export const WHATSAPP_PROFILE_SCHEDULE_QUEUE = 'whatsapp-profile-schedule'
export const WHATSAPP_PROFILE_SYNC_QUEUE = 'whatsapp-profile-sync'
export const WHATSAPP_PROFILE_SCHEDULE_JOB = 'schedule-due-profiles'
export const WHATSAPP_PROFILE_SYNC_JOB = 'sync-profile'

export const WHATSAPP_PROFILE_SYNC_INTERVAL_MS = 5 * 60 * 1_000
export const WHATSAPP_PROFILE_SYNC_BATCH_SIZE = 25
export const WHATSAPP_PROFILE_SYNC_CONCURRENCY = 2
export const WHATSAPP_PROFILE_SYNC_DUE_INTERVAL_MS = 24 * 60 * 60 * 1_000

export type WhatsAppProfileSyncJobData = {
  accountId: string
}
