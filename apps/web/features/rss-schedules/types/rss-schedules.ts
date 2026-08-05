export type RssScheduleStatus = "active" | "paused"

export type RssSchedule = {
  id: string
  name: string
  feedUrl: string
  targets: string[]
  status: RssScheduleStatus
  nextRun: string
  lastRun: string
  queued: number
}
