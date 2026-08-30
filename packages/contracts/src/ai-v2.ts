import { z } from "zod"

export const aiRequestKindSchema = z.enum([
  "agent",
  "content",
  "image",
  "video",
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

export const aiReasoningEffortSchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
])

export const aiModelCapabilitySchema = z.enum(["text", "image", "video"])

export const adminAiProviderKeySchema = z.enum([
  "openai",
  "atlascloud",
  "deepseek",
  "qwen",
  "anthropic",
])

export const aiModelModeSchema = z.enum([
  "text-to-image",
  "image-to-image",
  "text-to-video",
  "image-to-video",
  "reference-to-video",
])

const aiPlatformSchema = z.enum([
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "x",
  "youtube",
  "email",
])

const contentInputSchema = z
  .object({
    objective: z.string().trim().min(1).max(160).default("engagement"),
    tone: z.string().trim().min(1).max(80).default("cercano"),
    language: z.string().trim().min(2).max(16).default("es"),
    platforms: z.array(aiPlatformSchema).min(1).max(7).default(["instagram"]),
    variantCount: z.number().int().min(1).max(8).default(3),
    includeHashtags: z.boolean().default(true),
    callToAction: z.string().trim().max(500).optional(),
  })
  .strict()

const imageInputSchema = z
  .object({
    objective: z.string().trim().min(1).max(160).default("engagement"),
    aspectRatio: z.enum(["1:1", "9:16", "16:9"]).default("1:1"),
    quality: z.enum(["low", "medium", "high"]).default("medium"),
    referenceAssetIds: z
      .array(z.uuid())
      .max(10)
      .refine((ids) => new Set(ids).size === ids.length)
      .default([]),
  })
  .strict()

const videoInputSchema = z
  .object({
    objective: z.string().trim().min(1).max(160).default("engagement"),
    aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
    durationSeconds: z
      .union([z.literal(4), z.literal(8), z.literal(12)])
      .default(8),
    referenceAssetIds: z
      .array(z.uuid())
      .max(9)
      .refine((ids) => new Set(ids).size === ids.length)
      .default([]),
  })
  .strict()

const repurposeInputSchema = z
  .object({
    objective: z.string().trim().min(1).max(160).default("adaptar"),
    tone: z.string().trim().min(1).max(80).default("cercano"),
    language: z.string().trim().min(2).max(16).default("es"),
    platforms: z.array(aiPlatformSchema).min(1).max(7).default(["instagram"]),
  })
  .strict()

const plannerInputSchema = z
  .object({
    durationDays: z.number().int().min(3).max(31).default(7),
    frequencyPerWeek: z.number().int().min(1).max(14).default(4),
    platforms: z.array(aiPlatformSchema).min(1).max(7).default(["instagram"]),
    startDate: z.iso.date().optional(),
  })
  .strict()

const reviewInputSchema = z
  .object({
    objective: z.string().trim().min(1).max(160).default("calidad"),
    language: z.string().trim().min(2).max(16).default("es"),
    platforms: z.array(aiPlatformSchema).max(7).default([]),
  })
  .strict()

const timingInputSchema = z
  .object({
    socialAccountIds: z.array(z.uuid()).max(20).default([]),
    timezone: z.string().trim().min(1).max(64).default("UTC"),
    historyDays: z.number().int().min(7).max(365).default(90),
  })
  .strict()

const searchInputSchema = z
  .object({
    types: z
      .array(z.enum(["caption", "publishing_post", "ai_request"]))
      .max(3)
      .default([]),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict()

const aiPublishingInputSchema = z
  .object({
    scheduleId: z.uuid().optional(),
    tone: z.string().trim().min(1).max(80).default("cercano"),
    targetSocialAccountIds: z.array(z.uuid()).min(1).max(20),
  })
  .strict()

export const aiRequestInputSchemas = {
  agent: z.object({}).strict(),
  content: contentInputSchema,
  image: imageInputSchema,
  video: videoInputSchema,
  repurpose: repurposeInputSchema,
  planner: plannerInputSchema,
  review: reviewInputSchema,
  timing: timingInputSchema,
  search: searchInputSchema,
  ai_publishing: aiPublishingInputSchema,
} as const

const contentVariantSchema = z.object({
  platform: aiPlatformSchema,
  hook: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  callToAction: z.string().nullable(),
})

export const aiContentResultSchema = z.object({
  summary: z.string(),
  variants: z.array(contentVariantSchema).min(1).max(8),
  suggestedTags: z.array(z.string()).max(20),
})

export const aiImageResultSchema = z.object({
  assets: z
    .array(
      z.object({
        fileAssetId: z.uuid(),
        width: z.number().int().positive().nullable(),
        height: z.number().int().positive().nullable(),
      })
    )
    .min(1),
  revisedPrompt: z.string().nullable(),
})

export const aiVideoResultSchema = z.object({
  fileAssetId: z.uuid(),
  durationSeconds: z.number().positive(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
})

export const aiRepurposeResultSchema = z.object({
  strategy: z.string(),
  variants: z
    .array(
      z.object({
        platform: aiPlatformSchema,
        format: z.string(),
        content: z.string(),
      })
    )
    .min(1),
})

export const aiPlannerResultSchema = z.object({
  summary: z.string(),
  items: z
    .array(
      z.object({
        date: z.iso.date(),
        platform: aiPlatformSchema,
        format: z.string(),
        idea: z.string(),
        objective: z.string(),
        callToAction: z.string(),
      })
    )
    .min(1)
    .max(100),
})

export const aiReviewResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: z.string(),
  dimensions: z.object({
    clarity: z.number().int().min(0).max(100),
    brandVoice: z.number().int().min(0).max(100),
    callToAction: z.number().int().min(0).max(100),
    safety: z.number().int().min(0).max(100),
  }),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  corrections: z.array(z.string()),
  revisedContent: z.string(),
})

export const aiTimingResultSchema = z.object({
  timezone: z.string(),
  sampleSize: z.number().int().nonnegative(),
  recommendations: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      hour: z.number().int().min(0).max(23),
      sampleCount: z.number().int().positive(),
      confidence: z.enum(["low", "medium", "high"]),
    })
  ),
})

export const aiSearchResultSchema = z.object({
  mode: z.enum(["lexical", "hybrid"]),
  results: z.array(
    z.object({
      id: z.uuid(),
      type: z.enum(["caption", "publishing_post", "ai_request"]),
      title: z.string().nullable(),
      excerpt: z.string(),
      score: z.number().min(0).max(1).nullable(),
    })
  ),
})

export const aiPublishingResultSchema = z.object({
  text: z.string(),
  publishingPostIds: z.array(z.uuid()),
})

export const aiAgentResultSchema = z.object({
  summary: z.string(),
  trace: z
    .array(
      z.object({
        agent: z.string().max(120),
        order: z.string().max(4000),
        output: z.string().max(20000),
      })
    )
    .max(24),
})

export const aiRequestResultSchemas = {
  agent: aiAgentResultSchema,
  content: aiContentResultSchema,
  image: aiImageResultSchema,
  video: aiVideoResultSchema,
  repurpose: aiRepurposeResultSchema,
  planner: aiPlannerResultSchema,
  review: aiReviewResultSchema,
  timing: aiTimingResultSchema,
  search: aiSearchResultSchema,
  ai_publishing: aiPublishingResultSchema,
} as const

export const portalAiRequestSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  kind: aiRequestKindSchema,
  status: aiRequestStatusSchema,
  prompt: z.string(),
  input: aiJsonObjectSchema,
  result: aiJsonObjectSchema,
  provider: z.string().nullable(),
  model: z.string().nullable(),
  costUnits: z.number().int().nonnegative(),
  progress: z.number().int().min(0).max(100),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostMicrousd: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative().nullable(),
  errorCode: z.string().nullable(),
  archivedAt: z.string().datetime().nullable(),
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
    search: z.string().trim().max(160).optional(),
    archived: z.coerce.boolean().default(false),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
export const createPortalAiRequestSchema = z
  .object({
    kind: aiRequestKindSchema,
    prompt: z.string().trim().min(1).max(20_000),
    input: aiJsonObjectSchema.refine(
      (input) => Object.keys(input).length <= 50
    ),
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(160)
      .regex(/^[A-Za-z0-9._-]+$/),
  })
  .strict()
  .superRefine((input, context) => {
    const parsed = aiRequestInputSchemas[input.kind].safeParse(input.input)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          message: issue.message,
          path: ["input", ...issue.path],
        })
      }
    }
  })

export const renamePortalAiRequestSchema = z
  .object({ title: z.string().trim().min(1).max(160) })
  .strict()

export const retryPortalAiRequestSchema = z
  .object({
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(160)
      .regex(/^[A-Za-z0-9._-]+$/),
  })
  .strict()

export const archivePortalAiRequestSchema = z
  .object({ archived: z.boolean() })
  .strict()

export const portalAiDashboardSchema = z.object({
  enabled: z.boolean(),
  providerReady: z.boolean(),
  credits: z.object({
    unlimited: z.boolean(),
    balanceUnits: z.number().int().nonnegative(),
    usedUnits: z.number().int().nonnegative(),
  }),
  counts: z.object({
    queued: z.number().int().nonnegative(),
    processing: z.number().int().nonnegative(),
    succeededThisCycle: z.number().int().nonnegative(),
    draftsThisCycle: z.number().int().nonnegative(),
  }),
  recentRequests: z.array(portalAiRequestSchema),
})
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
  brandConfigured: z.boolean(),
  brandVoice: z.string(),
  brandName: z.string(),
  brandDescription: z.string(),
  brandPersonality: z.string(),
  preferredWords: z.array(z.string()),
  forbiddenWords: z.array(z.string()),
  requireHumanReview: z.boolean(),
  warnSensitiveClaims: z.boolean(),
  redactPersonalData: z.boolean(),
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
    brandName: z.string().trim().max(160).optional(),
    brandDescription: z.string().trim().max(5000).optional(),
    brandPersonality: z.string().trim().max(80).optional(),
    preferredWords: z
      .array(z.string().trim().min(1).max(80))
      .max(50)
      .optional(),
    forbiddenWords: z
      .array(z.string().trim().min(1).max(80))
      .max(50)
      .optional(),
    requireHumanReview: z.boolean().optional(),
    warnSensitiveClaims: z.boolean().optional(),
    redactPersonalData: z.boolean().optional(),
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
  costs: z.array(
    z.object({
      kind: aiRequestKindSchema,
      units: z.number().int().nonnegative(),
    })
  ),
  budget: z.object({
    monthlyMicrousd: z.number().int().min(0).max(2_147_483_647).nullable(),
    alertPercent: z.number().int().min(1).max(100),
    alertsEnabled: z.boolean(),
  }),
})
export const updatePortalAiBudgetSchema = z
  .object({
    monthlyMicrousd: z.number().int().min(0).max(2_147_483_647).nullable(),
    alertPercent: z.number().int().min(1).max(100),
    alertsEnabled: z.boolean(),
  })
  .strict()

export const adminAiProviderReadinessSchema = z.enum([
  "disabled",
  "incomplete",
  "untested",
  "ready",
  "error",
])

export const adminAiModelSchema = z.object({
  id: z.uuid(),
  providerKey: adminAiProviderKeySchema,
  modelId: z.string().min(1).max(160),
  label: z.string().min(1).max(160),
  capability: aiModelCapabilitySchema,
  tier: z.enum(["quality", "balanced", "economy", "specialized"]),
  enabled: z.boolean(),
  deprecated: z.boolean(),
  inputPriceMicrousdPerMillion: z.number().int().nonnegative().nullable(),
  outputPriceMicrousdPerMillion: z.number().int().nonnegative().nullable(),
  unitPriceMicrousd: z.number().int().nonnegative().nullable(),
  modes: z.array(aiModelModeSchema),
})

export const adminAiRouteSchema = z.object({
  kind: aiRequestKindSchema,
  primaryModelId: z.uuid().nullable(),
  fallbackModelId: z.uuid().nullable(),
  referenceModelId: z.uuid().nullable(),
  referenceFallbackModelId: z.uuid().nullable(),
  reasoningEffort: aiReasoningEffortSchema,
  costUnits: z.number().int().min(0).max(10000),
  enabled: z.boolean(),
})

export const adminAiConfigurationSchema = z.object({
  providers: z.array(
    z.object({
      providerKey: adminAiProviderKeySchema,
      label: z.string(),
      capabilities: z.array(aiModelCapabilitySchema),
      enabled: z.boolean(),
      readiness: adminAiProviderReadinessSchema,
      apiKeyConfigured: z.boolean(),
      lastTestedAt: z.string().datetime().nullable(),
      readinessIssues: z.array(z.string()),
    })
  ),
  models: z.array(adminAiModelSchema),
  routes: z.array(adminAiRouteSchema),
})

const optionalApiKeySchema = z.string().trim().min(20).max(4096).optional()

export const testAdminAiProviderSchema = z
  .object({ apiKey: optionalApiKeySchema })
  .strict()

export const updateAdminAiProviderSchema = z
  .object({ enabled: z.boolean(), apiKey: optionalApiKeySchema })
  .strict()

export const createAdminAiModelSchema = z
  .object({
    providerKey: adminAiProviderKeySchema,
    modelId: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9._:/-]+$/),
    label: z.string().trim().min(1).max(160),
    capability: aiModelCapabilitySchema,
    tier: z.enum(["quality", "balanced", "economy", "specialized"]),
    enabled: z.boolean().default(false),
    deprecated: z.boolean().default(false),
    inputPriceMicrousdPerMillion: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .default(null),
    outputPriceMicrousdPerMillion: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .default(null),
    unitPriceMicrousd: z.number().int().nonnegative().nullable().default(null),
    modes: z.array(aiModelModeSchema).max(5).default([]),
  })
  .strict()

export const updateAdminAiModelSchema = createAdminAiModelSchema
  .omit({ providerKey: true, modelId: true })
  .partial()
  .refine((input) => Object.keys(input).length > 0)

export const adminAiAgentKindSchema = z.enum(["orchestrator", "specialist"])

export const adminAiAgentSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500),
  systemPrompt: z.string().max(20000),
  kind: adminAiAgentKindSchema,
  modelId: z.uuid().nullable(),
  tools: z.array(z.string().min(1).max(80)).max(20),
  enabled: z.boolean(),
  canvasPosition: z.object({ x: z.number(), y: z.number() }),
})

export const adminAiAgentEdgeSchema = z.object({
  id: z.uuid(),
  sourceAgentId: z.uuid(),
  targetAgentId: z.uuid(),
})

export const adminAiAgentsSchema = z.object({
  agents: z.array(adminAiAgentSchema),
  edges: z.array(adminAiAgentEdgeSchema),
  models: z.array(adminAiModelSchema),
})

export const updateAdminAiAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500),
    systemPrompt: z.string().trim().max(20000),
    modelId: z.uuid().nullable(),
    enabled: z.boolean(),
    canvasPosition: z
      .object({ x: z.number().finite(), y: z.number().finite() })
      .strict(),
  })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0)

export const updateAdminAiRouteSchema = z
  .object({
    primaryModelId: z.uuid().nullable(),
    fallbackModelId: z.uuid().nullable(),
    referenceModelId: z.uuid().nullable(),
    referenceFallbackModelId: z.uuid().nullable(),
    reasoningEffort: aiReasoningEffortSchema,
    costUnits: z.number().int().min(0).max(10000),
    enabled: z.boolean(),
  })
  .strict()

export const adminAiUsageSchema = z.object({
  periodDays: z.number().int().positive(),
  requests: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostMicrousd: z.number().int().nonnegative(),
  averageLatencyMs: z.number().int().nonnegative(),
  byModel: z.array(
    z.object({
      model: z.string(),
      requests: z.number().int().nonnegative(),
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      estimatedCostMicrousd: z.number().int().nonnegative(),
    })
  ),
})

export const adminAiRequestLogSchema = z.object({
  id: z.uuid(),
  createdAt: z.string().datetime(),
  kind: aiRequestKindSchema,
  status: z.enum(["queued", "processing", "succeeded", "failed", "cancelled"]),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  workspaceName: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostMicrousd: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative().nullable(),
  errorCode: z.string().nullable(),
})
export const adminAiRequestsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    provider: z.string().trim().min(1).max(64).optional(),
    kind: aiRequestKindSchema.optional(),
    status: z
      .enum(["queued", "processing", "succeeded", "failed", "cancelled"])
      .optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
export const adminAiRequestsResponseSchema = z.object({
  requests: z.array(adminAiRequestLogSchema),
  providers: z.array(z.string()),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

export const adminAiReportQuerySchema = z
  .object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .strict()
export const adminAiReportSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  totals: z.object({
    requests: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    tokens: z.number().int().nonnegative(),
    estimatedCostMicrousd: z.number().int().nonnegative(),
    averageLatencyMs: z.number().int().nonnegative(),
    successRate: z.number().min(0).max(100),
  }),
  daily: z.array(
    z.object({
      date: z.string().date(),
      requests: z.number().int().nonnegative(),
      tokens: z.number().int().nonnegative(),
      estimatedCostMicrousd: z.number().int().nonnegative(),
      successRate: z.number().min(0).max(100),
      averageLatencyMs: z.number().int().nonnegative(),
    })
  ),
  byProvider: z.array(
    z.object({
      provider: z.string(),
      requests: z.number().int().nonnegative(),
      tokens: z.number().int().nonnegative(),
      estimatedCostMicrousd: z.number().int().nonnegative(),
      successRate: z.number().min(0).max(100),
    })
  ),
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
export type AiReasoningEffort = z.infer<typeof aiReasoningEffortSchema>
export type AdminAiProviderKey = z.infer<typeof adminAiProviderKeySchema>
export type AiModelMode = z.infer<typeof aiModelModeSchema>
export type PortalAiRequest = z.infer<typeof portalAiRequestSchema>
export type PortalAiRequestsResponse = z.infer<
  typeof portalAiRequestsResponseSchema
>
export type PortalAiRequestsQuery = z.infer<typeof portalAiRequestsQuerySchema>
export type CreatePortalAiRequestInput = z.infer<
  typeof createPortalAiRequestSchema
>
export type RenamePortalAiRequestInput = z.infer<
  typeof renamePortalAiRequestSchema
>
export type RetryPortalAiRequestInput = z.infer<
  typeof retryPortalAiRequestSchema
>
export type ArchivePortalAiRequestInput = z.infer<
  typeof archivePortalAiRequestSchema
>
export type PortalAiDashboard = z.infer<typeof portalAiDashboardSchema>
export type UsePortalAiRequestAsDraftInput = z.infer<
  typeof usePortalAiRequestAsDraftSchema
>
export type PortalAiDraftResult = z.infer<typeof portalAiDraftResultSchema>
export type PortalAiSettings = z.infer<typeof portalAiSettingsSchema>
export type UpdatePortalAiSettingsInput = z.infer<
  typeof updatePortalAiSettingsSchema
>
export type PortalCreditsResponse = z.infer<typeof portalCreditsResponseSchema>
export type UpdatePortalAiBudgetInput = z.infer<
  typeof updatePortalAiBudgetSchema
>
export type AdminAiConfiguration = z.infer<typeof adminAiConfigurationSchema>
export type AdminAiAgent = z.infer<typeof adminAiAgentSchema>
export type AdminAiAgentEdge = z.infer<typeof adminAiAgentEdgeSchema>
export type AdminAiAgents = z.infer<typeof adminAiAgentsSchema>
export type UpdateAdminAiAgentInput = z.infer<typeof updateAdminAiAgentSchema>
export type AdminAiModel = z.infer<typeof adminAiModelSchema>
export type AdminAiRoute = z.infer<typeof adminAiRouteSchema>
export type TestAdminAiProviderInput = z.infer<typeof testAdminAiProviderSchema>
export type UpdateAdminAiProviderInput = z.infer<
  typeof updateAdminAiProviderSchema
>
export type CreateAdminAiModelInput = z.infer<typeof createAdminAiModelSchema>
export type UpdateAdminAiModelInput = z.infer<typeof updateAdminAiModelSchema>
export type UpdateAdminAiRouteInput = z.infer<typeof updateAdminAiRouteSchema>
export type AdminAiUsage = z.infer<typeof adminAiUsageSchema>
export type AdminAiRequestLog = z.infer<typeof adminAiRequestLogSchema>
export type AdminAiRequestsQuery = z.infer<typeof adminAiRequestsQuerySchema>
export type AdminAiRequestsResponse = z.infer<
  typeof adminAiRequestsResponseSchema
>
export type AdminAiReportQuery = z.infer<typeof adminAiReportQuerySchema>
export type AdminAiReport = z.infer<typeof adminAiReportSchema>
export type PortalAiPublishingSchedule = z.infer<
  typeof portalAiPublishingScheduleSchema
>
export type CreatePortalAiPublishingScheduleInput = z.infer<
  typeof createPortalAiPublishingScheduleSchema
>
export type UpdatePortalAiPublishingScheduleInput = z.infer<
  typeof updatePortalAiPublishingScheduleSchema
>
