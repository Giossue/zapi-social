export type PublishingStatus = "draft" | "failed" | "pending" | "published" | "scheduled"

export type PublishingPost = {
  id: string
  date: string
  time: string
  title: string
  channel: string
  provider: string
  status: PublishingStatus
}

export type PublishingCalendarData = {
  focusDate: string
  posts: PublishingPost[]
}
