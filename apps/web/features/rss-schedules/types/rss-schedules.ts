export type RssScheduleStatus = "active" | "paused"

export type RssSchedule = {
  id: string
  name: string
  feedUrl: string
  targets: string[]
  status: RssScheduleStatus
  nextRunAt: string | null
  lastRunAt: string | null
  queued: number
}
