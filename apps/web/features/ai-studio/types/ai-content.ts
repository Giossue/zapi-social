export type AIContentTemplate = {
  id: string
  title: string
  description: string
  prompt: string
}

export type AIContentDraft = {
  id: string
  title: string
  excerpt: string
  platforms: readonly string[]
  updatedAt: string
}

export type AIContentResult = {
  id: string
  title: string
  content: string
  tags: readonly string[]
}

export type AIContentStudioData = {
  canUse: boolean
  creditsAvailable: number
  templates: readonly AIContentTemplate[]
  drafts: readonly AIContentDraft[]
  initialResults: readonly AIContentResult[]
}
