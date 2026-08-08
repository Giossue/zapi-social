import { z } from "zod"

export const aiRequestKindSchema = z.enum([
  "content",
  "image",
  "repurpose",
  "planner",
  "review",
  "timing",
  "search",
  "ai_publishing",
])
export const aiRequestStatusSchema = z.enum([
  "queued",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
])
const aiJsonObjectSchema = z.record(z.string().max(80), z.unknown())
export const portalAiRequestSchema = z.object({
  id: z.uuid(),
  kind: aiRequestKindSchema,
  status: aiRequestStatusSchema,
  prompt: z.string(),
  input: aiJsonObjectSchema,
  result: aiJsonObjectSchema,
  provider: z.string().nullable(),
  model: z.string().nullable(),
  costUnits: z.number().int().nonnegative(),
  errorCode: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export const portalAiRequestsResponseSchema = z.object({
  requests: z.array(portalAiRequestSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})
export const portalAiRequestsQuerySchema = z
  .object({
    kind: aiRequestKindSchema.optional(),
    status: aiRequestStatusSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
export const createPortalAiRequestSchema = z
  .object({
    kind: aiRequestKindSchema,
    prompt: z.string().trim().min(1).max(20_000),
    input: aiJsonObjectSchema
      .refine((input) => Object.keys(input).length <= 50)
      .default({}),
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(160)
      .regex(/^[A-Za-z0-9._-]+$/),
  })
  .strict()
export const usePortalAiRequestAsDraftSchema = z
  .object({
    socialAccountIds: z
      .array(z.uuid())
      .min(1)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length),
    mediaAssetIds: z
      .array(z.uuid())
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length)
      .default([]),
  })
  .strict()
export const portalAiDraftResultSchema = z.object({
  publishingPostIds: z.array(z.uuid()),
})

export const portalAiSettingsSchema = z.object({
  preferredProvider: z.string(),
  preferredTextModel: z.string().nullable(),
  preferredImageModel: z.string().nullable(),
  brandVoice: z.string(),
  defaultTone: z.string(),
  language: z.string(),
  enforceCredits: z.boolean(),
  user: z.object({
    defaultTone: z.string().nullable(),
    language: z.string().nullable(),
    preferences: aiJsonObjectSchema,
  }),
})
export const updatePortalAiSettingsSchema = z
  .object({
    brandVoice: z.string().trim().max(5000).optional(),
    defaultTone: z.string().trim().min(1).max(80).optional(),
    language: z.string().trim().min(2).max(16).optional(),
    userDefaultTone: z.string().trim().min(1).max(80).nullable().optional(),
    userLanguage: z.string().trim().min(2).max(16).nullable().optional(),
    userPreferences: aiJsonObjectSchema
      .refine((input) => Object.keys(input).length <= 50)
      .optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0)

export const portalCreditLedgerEntrySchema = z.object({
  id: z.uuid(),
  type: z.enum(["grant", "debit", "refund", "adjustment"]),
  action: z.string(),
  units: z.number().int(),
  aiRequestId: z.uuid().nullable(),
  createdAt: z.string().datetime(),
})
export const portalCreditsResponseSchema = z.object({
  unlimited: z.boolean(),
  balanceUnits: z.number().int().nonnegative(),
  usedUnits: z.number().int().nonnegative(),
  cycleStartedAt: z.string().datetime().nullable(),
  cycleEndsAt: z.string().datetime().nullable(),
  entries: z.array(portalCreditLedgerEntrySchema),
})

export const aiPublishingScheduleStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
])
export const aiPublishingFrequencySchema = z.enum(["daily", "weekly"])
const aiWeekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
])
const aiTimeSchema = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
const aiTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format()
      return true
    } catch {
      return false
    }
  })
const aiPublishingTargetIdsSchema = z
  .array(z.uuid())
  .min(1)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length)
export const portalAiPublishingScheduleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  prompt: z.string(),
  status: aiPublishingScheduleStatusSchema,
  frequency: aiPublishingFrequencySchema,
  timezone: z.string(),
  preferredTime: aiTimeSchema,
  weekdays: z.array(aiWeekdaySchema),
  tone: z.string(),
  targetSocialAccountIds: z.array(z.uuid()),
  nextRunAt: z.string().datetime().nullable(),
  lastRunAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
const aiPublishingScheduleFields = {
  name: z.string().trim().min(1).max(160),
  prompt: z.string().trim().min(1).max(20_000),
  status: aiPublishingScheduleStatusSchema.default("draft"),
  frequency: aiPublishingFrequencySchema.default("daily"),
  timezone: aiTimezoneSchema,
  preferredTime: aiTimeSchema,
  weekdays: z
    .array(aiWeekdaySchema)
    .max(7)
    .refine((values) => new Set(values).size === values.length)
    .default([]),
  tone: z.string().trim().min(1).max(80).default("cercano"),
  targetSocialAccountIds: aiPublishingTargetIdsSchema,
}
export const createPortalAiPublishingScheduleSchema = z
  .object(aiPublishingScheduleFields)
  .strict()
  .superRefine((input, context) => {
    if (input.frequency === "weekly" && input.weekdays.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Selecciona al menos un día para la frecuencia semanal.",
      })
    }
  })
export const updatePortalAiPublishingScheduleSchema = z
  .object({
    name: aiPublishingScheduleFields.name.optional(),
    prompt: aiPublishingScheduleFields.prompt.optional(),
    status: aiPublishingScheduleStatusSchema.optional(),
    frequency: aiPublishingFrequencySchema.optional(),
    timezone: aiPublishingScheduleFields.timezone.optional(),
    preferredTime: aiTimeSchema.optional(),
    weekdays: aiPublishingScheduleFields.weekdays.optional(),
    tone: aiPublishingScheduleFields.tone.optional(),
    targetSocialAccountIds: aiPublishingTargetIdsSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0)

export type AiRequestKind = z.infer<typeof aiRequestKindSchema>
export type AiRequestStatus = z.infer<typeof aiRequestStatusSchema>
export type PortalAiRequest = z.infer<typeof portalAiRequestSchema>
export type PortalAiRequestsResponse = z.infer<
  typeof portalAiRequestsResponseSchema
>
export type PortalAiRequestsQuery = z.infer<typeof portalAiRequestsQuerySchema>
export type CreatePortalAiRequestInput = z.infer<
  typeof createPortalAiRequestSchema
>
export type UsePortalAiRequestAsDraftInput = z.infer<
  typeof usePortalAiRequestAsDraftSchema
>
export type PortalAiDraftResult = z.infer<typeof portalAiDraftResultSchema>
export type PortalAiSettings = z.infer<typeof portalAiSettingsSchema>
export type UpdatePortalAiSettingsInput = z.infer<
  typeof updatePortalAiSettingsSchema
>
export type PortalCreditsResponse = z.infer<typeof portalCreditsResponseSchema>
export type PortalAiPublishingSchedule = z.infer<
  typeof portalAiPublishingScheduleSchema
>
export type CreatePortalAiPublishingScheduleInput = z.infer<
  typeof createPortalAiPublishingScheduleSchema
>
export type UpdatePortalAiPublishingScheduleInput = z.infer<
  typeof updatePortalAiPublishingScheduleSchema
>
