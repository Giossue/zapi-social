import type { AiRequestKind } from "@workspace/contracts"

export type ChatTool = Exclude<AiRequestKind, "ai_publishing">

type ToolOption = { labelKey: string; value: string }

export type ToolOptionField =
  | { kind: "text"; labelKey: string; name: string; placeholderKey?: string }
  | { kind: "number"; labelKey: string; max: number; min: number; name: string }
  | { kind: "date"; labelKey: string; name: string }
  | {
      kind: "select"
      labelKey: string
      name: string
      options: readonly ToolOption[]
    }
  | {
      kind: "toggles"
      labelKey: string
      name: string
      options: readonly ToolOption[]
    }
  | { kind: "switch"; labelKey: string; name: string }

export type ToolDefinition = {
  descriptionKey: string
  fields: readonly ToolOptionField[]
  labelKey: string
  placeholderKey: string
  promptLabelKey: string
  values: Record<string, unknown>
}

const platforms = [
  { labelKey: "platform.instagram", value: "instagram" },
  { labelKey: "platform.facebook", value: "facebook" },
  { labelKey: "platform.linkedin", value: "linkedin" },
  { labelKey: "platform.tiktok", value: "tiktok" },
  { labelKey: "platform.x", value: "x" },
  { labelKey: "platform.youtube", value: "youtube" },
  { labelKey: "platform.email", value: "email" },
] as const

const languages = [
  { labelKey: "language.es", value: "es" },
  { labelKey: "language.en", value: "en" },
  { labelKey: "language.pt", value: "pt" },
] as const

const tones = [
  { labelKey: "tone.cercano", value: "cercano" },
  { labelKey: "tone.profesional", value: "profesional" },
  { labelKey: "tone.divertido", value: "divertido" },
  { labelKey: "tone.inspirador", value: "inspirador" },
  { labelKey: "tone.directo", value: "directo" },
] as const

export const chatTools: Record<ChatTool, ToolDefinition> = {
  content: {
    descriptionKey: "content.description",
    fields: [
      { kind: "text", labelKey: "field.objective", name: "objective" },
      { kind: "select", labelKey: "field.tone", name: "tone", options: tones },
      {
        kind: "select",
        labelKey: "field.language",
        name: "language",
        options: languages,
      },
      {
        kind: "toggles",
        labelKey: "field.platforms",
        name: "platforms",
        options: platforms,
      },
      {
        kind: "number",
        labelKey: "field.variantCount",
        max: 8,
        min: 1,
        name: "variantCount",
      },
      {
        kind: "switch",
        labelKey: "field.includeHashtags",
        name: "includeHashtags",
      },
      {
        kind: "text",
        labelKey: "field.callToAction",
        name: "callToAction",
        placeholderKey: "field.optional",
      },
    ],
    labelKey: "content.label",
    placeholderKey: "content.placeholder",
    promptLabelKey: "content.promptLabel",
    values: {
      callToAction: "",
      includeHashtags: true,
      language: "es",
      objective: "engagement",
      platforms: ["instagram"],
      tone: "cercano",
      variantCount: 3,
    },
  },
  image: {
    descriptionKey: "image.description",
    fields: [
      { kind: "text", labelKey: "field.objective", name: "objective" },
      {
        kind: "select",
        labelKey: "field.aspectRatio",
        name: "aspectRatio",
        options: [
          { labelKey: "ratio.square", value: "1:1" },
          { labelKey: "ratio.vertical", value: "9:16" },
          { labelKey: "ratio.horizontal", value: "16:9" },
        ],
      },
      {
        kind: "select",
        labelKey: "field.quality",
        name: "quality",
        options: [
          { labelKey: "quality.low", value: "low" },
          { labelKey: "quality.medium", value: "medium" },
          { labelKey: "quality.high", value: "high" },
        ],
      },
    ],
    labelKey: "image.label",
    placeholderKey: "image.placeholder",
    promptLabelKey: "image.promptLabel",
    values: { aspectRatio: "1:1", objective: "engagement", quality: "medium" },
  },
  video: {
    descriptionKey: "video.description",
    fields: [
      { kind: "text", labelKey: "field.objective", name: "objective" },
      {
        kind: "select",
        labelKey: "field.aspectRatio",
        name: "aspectRatio",
        options: [
          { labelKey: "ratio.vertical", value: "9:16" },
          { labelKey: "ratio.horizontal", value: "16:9" },
          { labelKey: "ratio.square", value: "1:1" },
        ],
      },
      {
        kind: "select",
        labelKey: "field.duration",
        name: "durationSeconds",
        options: [
          { labelKey: "duration.4", value: "4" },
          { labelKey: "duration.8", value: "8" },
          { labelKey: "duration.12", value: "12" },
        ],
      },
    ],
    labelKey: "video.label",
    placeholderKey: "video.placeholder",
    promptLabelKey: "video.promptLabel",
    values: {
      aspectRatio: "9:16",
      durationSeconds: 8,
      objective: "engagement",
    },
  },
  repurpose: {
    descriptionKey: "repurpose.description",
    fields: [
      { kind: "text", labelKey: "field.objective", name: "objective" },
      { kind: "select", labelKey: "field.tone", name: "tone", options: tones },
      {
        kind: "select",
        labelKey: "field.language",
        name: "language",
        options: languages,
      },
      {
        kind: "toggles",
        labelKey: "field.targetPlatforms",
        name: "platforms",
        options: platforms,
      },
    ],
    labelKey: "repurpose.label",
    placeholderKey: "repurpose.placeholder",
    promptLabelKey: "repurpose.promptLabel",
    values: {
      language: "es",
      objective: "adaptar",
      platforms: ["instagram"],
      tone: "cercano",
    },
  },
  review: {
    descriptionKey: "review.description",
    fields: [
      { kind: "text", labelKey: "field.objective", name: "objective" },
      {
        kind: "select",
        labelKey: "field.language",
        name: "language",
        options: languages,
      },
      {
        kind: "toggles",
        labelKey: "field.platforms",
        name: "platforms",
        options: platforms,
      },
    ],
    labelKey: "review.label",
    placeholderKey: "review.placeholder",
    promptLabelKey: "review.promptLabel",
    values: { language: "es", objective: "calidad", platforms: [] },
  },
  planner: {
    descriptionKey: "planner.description",
    fields: [
      {
        kind: "number",
        labelKey: "field.durationDays",
        max: 31,
        min: 3,
        name: "durationDays",
      },
      {
        kind: "number",
        labelKey: "field.frequencyPerWeek",
        max: 14,
        min: 1,
        name: "frequencyPerWeek",
      },
      {
        kind: "toggles",
        labelKey: "field.platforms",
        name: "platforms",
        options: platforms,
      },
      { kind: "date", labelKey: "field.startDate", name: "startDate" },
    ],
    labelKey: "planner.label",
    placeholderKey: "planner.placeholder",
    promptLabelKey: "planner.promptLabel",
    values: {
      durationDays: 7,
      frequencyPerWeek: 4,
      platforms: ["instagram"],
      startDate: "",
    },
  },
  timing: {
    descriptionKey: "timing.description",
    fields: [
      { kind: "text", labelKey: "field.timezone", name: "timezone" },
      {
        kind: "number",
        labelKey: "field.historyDays",
        max: 365,
        min: 7,
        name: "historyDays",
      },
    ],
    labelKey: "timing.label",
    placeholderKey: "timing.placeholder",
    promptLabelKey: "timing.promptLabel",
    values: { historyDays: 90, socialAccountIds: [], timezone: "UTC" },
  },
  search: {
    descriptionKey: "search.description",
    fields: [
      {
        kind: "toggles",
        labelKey: "field.searchIn",
        name: "types",
        options: [
          { labelKey: "searchType.caption", value: "caption" },
          { labelKey: "searchType.publishing_post", value: "publishing_post" },
          { labelKey: "searchType.ai_request", value: "ai_request" },
        ],
      },
      {
        kind: "number",
        labelKey: "field.limit",
        max: 50,
        min: 1,
        name: "limit",
      },
    ],
    labelKey: "search.label",
    placeholderKey: "search.placeholder",
    promptLabelKey: "search.promptLabel",
    values: { limit: 20, types: [] },
  },
}

export const chatToolKeys = Object.keys(chatTools) as ChatTool[]

export function isChatTool(value: string | null): value is ChatTool {
  return Boolean(value) && chatToolKeys.includes(value as ChatTool)
}
