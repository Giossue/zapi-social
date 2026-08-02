export type CaptionSourceType = "manual" | "ai"
export type CaptionStatus = "active" | "draft" | "archived"

export type Caption = {
  id: string
  name: string
  sourceType: CaptionSourceType
  status: CaptionStatus
  content: string
  notes: string | null
  tags: string[]
  updatedAt: string
}

export type CaptionDraft = Omit<Caption, "id" | "updatedAt">

export type CaptionFilters = {
  query: string
  sourceType: CaptionSourceType | "all"
  status: CaptionStatus | "all"
}

export type CaptionMetrics = {
  total: number
  ai: number
  manual: number
  active: number
}
