export type PublishingProvider = "facebook" | "instagram" | "whatsapp"

export type PublishingStatus =
  "draft" | "failed" | "processing" | "published" | "scheduled"

export type PublishingAccount = {
  id: string
  name: string
  assignedName?: string
  provider: PublishingProvider
  detail: string
  connected: boolean
}

export type PublishingPost = {
  id: string
  date: string
  time: string
  title: string
  content: string
  channel: string
  provider: PublishingProvider
  status: PublishingStatus
  hasMedia: boolean
  recoverable?: boolean
}

export type PublishingCalendarData = {
  focusDate: string
  accounts: PublishingAccount[]
  posts: PublishingPost[]
  canView: boolean
}
