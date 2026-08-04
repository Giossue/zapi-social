export type PublishingProvider = "facebook" | "instagram" | "whatsapp"

export type PublishingStatus =
  "draft" | "failed" | "processing" | "published" | "scheduled"

export type PublishingAccount = {
  id: string
  name: string
  assignedName?: string | null
  provider: PublishingProvider
  detail: string
  connected: boolean
}

export type PublishingPost = {
  id: string
  socialAccountId: string
  date: string
  time: string
  title: string
  content: string
  channel: string
  provider: PublishingProvider
  status: PublishingStatus
  hasMedia: boolean
  recoverable?: boolean
  mediaAssetIds: string[]
}

export type PublishingMediaAsset = {
  id: string
  kind: "image" | "video"
  name: string
  thumbnailStatus: "pending" | "ready" | "failed" | "not_applicable"
}

export type PublishingCalendarData = {
  focusDate: string
  accounts: PublishingAccount[]
  posts: PublishingPost[]
  canView: boolean
  canManage?: boolean
  media?: PublishingMediaAsset[]
}
