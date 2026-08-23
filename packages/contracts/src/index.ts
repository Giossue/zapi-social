import { z } from "zod"

const passwordPolicy = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(128)
  .regex(/[A-Z]/, "La contraseña debe incluir una mayúscula.")
  .regex(/[a-z]/, "La contraseña debe incluir una minúscula.")
  .regex(/[0-9]/, "La contraseña debe incluir un número.")
  .regex(/[^A-Za-z0-9]/, "La contraseña debe incluir un carácter especial.")

function isSupportedTimeZone(value: string) {
  try {
    return (
      Intl.DateTimeFormat(undefined, { timeZone: value }).resolvedOptions()
        .timeZone === value
    )
  } catch {
    return false
  }
}

const profileTimeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isSupportedTimeZone, "La zona horaria no es válida.")

const turnstileTokenSchema = z.string().trim().min(1).max(4096)

export const registerSchema = z.object({
  email: z.string().trim().email().max(320),
  password: passwordPolicy,
  displayName: z.string().trim().min(2).max(160),
  timezone: profileTimeZoneSchema,
  referralId: z.uuid().optional(),
  turnstileToken: turnstileTokenSchema.optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
  remember: z.boolean().default(false),
  turnstileToken: turnstileTokenSchema.optional(),
})

export const publicTurnstileConfigurationSchema = z.object({
  enabled: z.boolean(),
  siteKey: z.string().nullable(),
})

export const adminTurnstileConfigurationSchema = z.object({
  enabled: z.boolean(),
  readiness: z.enum(["ready", "incomplete", "disabled"]),
  siteKey: z.string().nullable(),
  secretConfigured: z.boolean(),
})

export const updateAdminTurnstileConfigurationSchema = z
  .object({
    enabled: z.boolean(),
    siteKey: z.string().trim().max(255),
    secretKey: z.string().trim().min(1).max(512).optional(),
  })
  .strict()

/** Idiomas con traducción disponible en la interfaz. */
export { supportedLocaleSchema } from "./locale.js"
import { supportedLocaleSchema } from "./locale.js"

export const portalProfileSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  email: z.string().email(),
  username: z.string().nullable(),
  emailVerifiedAt: z.string().datetime().nullable(),
  locale: supportedLocaleSchema.nullable(),
  timezone: profileTimeZoneSchema.nullable(),
  createdAt: z.string().datetime(),
})

export const updatePortalProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(160),
    locale: supportedLocaleSchema.nullable(),
    timezone: profileTimeZoneSchema,
  })
  .strict()

export const changePortalPasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordPolicy,
    passwordConfirmation: z.string().min(1).max(128),
  })
  .refine((input) => input.newPassword === input.passwordConfirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"],
  })

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  displayName: z.string(),
  /** Idioma elegido por el usuario; `null` usa el idioma por defecto. */
  locale: supportedLocaleSchema.nullable(),
})

export const activeWorkspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  role: z.enum(["owner", "admin", "member"]),
})

export const activateAuthWorkspaceSchema = z
  .object({ workspaceId: z.uuid() })
  .strict()

export const platformAdminAuthSessionSchema = z.object({
  user: authUserSchema,
  area: z.literal("admin"),
})

export const portalAuthSessionSchema = z.object({
  user: authUserSchema,
  area: z.literal("portal"),
  workspace: activeWorkspaceSchema,
  workspaces: z.array(activeWorkspaceSchema).min(1),
})

export const authSessionSchema = z.discriminatedUnion("area", [
  platformAdminAuthSessionSchema,
  portalAuthSessionSchema,
])

const dashboardKpiChangeSchema = z
  .object({
    direction: z.enum(["up", "down"]),
    label: z.string(),
  })
  .nullable()

/**
 * El KPI viaja como clave, no como texto: la etiqueta, su descripción y su
 * icono los resuelve la interfaz según el idioma activo.
 */
const portalDashboardKpiSchema = z.object({
  key: z.enum(["publishedPosts", "activeChannels", "aiCredits", "newFiles"]),
  value: z.string(),
  change: dashboardKpiChangeSchema,
  descriptionKey: z.enum([
    "previousWeeks",
    "connectedRecently",
    "noRecentConnections",
  ]),
})

const dashboardComparisonPointSchema = z.object({
  date: z.string(),
  current: z.number().int().nonnegative(),
  previous: z.number().int().nonnegative(),
})

const dashboardDayCountSchema = z.object({
  date: z.string(),
  count: z.number().int().nonnegative(),
})

/**
 * Los desgloses viajan por clave —proveedor, tipo de uso AI o plan— para que
 * la interfaz decida su rótulo. `none` representa el registro sin canal.
 */
const dashboardBreakdownItemSchema = z.object({
  key: z.string(),
  count: z.number().int().nonnegative(),
})

export const portalCaptionSourceTypeSchema = z.enum(["manual", "ai"])
export const portalCaptionStatusSchema = z.enum(["active", "draft", "archived"])

const portalCaptionTagsSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(20)
  .transform((tags) => {
    const unique = new Map<string, string>()
    for (const tag of tags) {
      const normalized = tag.trim()
      if (normalized) unique.set(normalized.toLocaleLowerCase("es"), normalized)
    }
    return [...unique.values()]
  })

export const portalCaptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sourceType: portalCaptionSourceTypeSchema,
  status: portalCaptionStatusSchema,
  content: z.string(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  updatedAt: z.string().datetime(),
})

export const portalCaptionMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  ai: z.number().int().nonnegative(),
  manual: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
})

export const portalCaptionsResponseSchema = z.object({
  captions: z.array(portalCaptionSchema),
  metrics: portalCaptionMetricsSchema,
})

export const portalCaptionsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    sourceType: portalCaptionSourceTypeSchema.optional(),
    status: portalCaptionStatusSchema.optional(),
  })
  .strict()

const portalCaptionInputFields = {
  name: z.string().trim().min(1).max(120),
  sourceType: portalCaptionSourceTypeSchema,
  status: portalCaptionStatusSchema,
  content: z.string().trim().min(1).max(10000),
  notes: z.string().trim().max(2000).nullable(),
  tags: portalCaptionTagsSchema,
}

export const createPortalCaptionSchema = z
  .object(portalCaptionInputFields)
  .strict()

export const updatePortalCaptionSchema = z
  .object({
    name: portalCaptionInputFields.name.optional(),
    sourceType: portalCaptionSourceTypeSchema.optional(),
    status: portalCaptionStatusSchema.optional(),
    content: portalCaptionInputFields.content.optional(),
    notes: portalCaptionInputFields.notes.optional(),
    tags: portalCaptionTagsSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Incluye al menos un campo para actualizar.",
  })

export const portalFileKindSchema = z.enum([
  "archive",
  "design",
  "document",
  "image",
  "pdf",
  "spreadsheet",
  "video",
])
export const portalFileStatusSchema = z.enum(["pending", "ready"])
export const portalFileAssetSchema = z.object({
  id: z.uuid(),
  folderId: z.uuid().nullable(),
  name: z.string(),
  kind: portalFileKindSchema,
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  owner: z.string(),
  ownerInitials: z.string(),
  modifiedAt: z.string().datetime(),
  starred: z.boolean(),
  thumbnailStatus: z.enum(["pending", "ready", "failed", "not_applicable"]),
})
export const portalFileFolderSchema = z.object({
  id: z.uuid(),
  parentFolderId: z.uuid().nullable(),
  name: z.string(),
  fileCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
})
export const portalFilesResponseSchema = z.object({
  canManage: z.boolean(),
  /** Ruta de la carpeta consultada, de la raíz hacia dentro. */
  folderPath: z.array(z.object({ id: z.uuid(), name: z.string() })),
  folders: z.array(portalFileFolderSchema),
  files: z.array(portalFileAssetSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  foldersTotal: z.number().int().nonnegative(),
  filesTotal: z.number().int().nonnegative(),
})
export const portalFileSortSchema = z.enum(["name", "modifiedAt"])
export const portalFileSortOrderSchema = z.enum(["asc", "desc"])
export const portalFilesQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    folderId: z.uuid().optional(),
    kind: portalFileKindSchema.optional(),
    starred: z.coerce.boolean().optional(),
    sort: portalFileSortSchema.default("modifiedAt"),
    order: portalFileSortOrderSchema.default("desc"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
export const createPortalFileFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    parentFolderId: z.uuid().nullable().optional(),
  })
  .strict()
export const updatePortalFileFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    parentFolderId: z.uuid().nullable().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0)
export const updatePortalFileAssetSchema = z
  .object({
    starred: z.boolean().optional(),
    folderId: z.uuid().nullable().optional(),
    name: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0)
export const startPortalFileUploadSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(127),
    sizeBytes: z.number().int().positive().max(104857600),
    folderId: z.uuid().nullable().optional(),
  })
  .strict()
export const completePortalFileUploadSchema = z.object({}).strict()

export const publishingProviderSchema = z.enum([
  "facebook",
  "instagram",
  "whatsapp",
])
export const publishingPostStatusSchema = z.enum([
  "draft",
  "scheduled",
  "processing",
  "published",
  "failed",
])
export const portalPublishingAccountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  assignedName: z.string().nullable(),
  provider: publishingProviderSchema,
  detail: z.string(),
  connected: z.boolean(),
})
export const portalPublishingPostSchema = z.object({
  id: z.uuid(),
  socialAccountId: z.uuid(),
  date: z.string(),
  time: z.string(),
  title: z.string(),
  content: z.string(),
  channel: z.string(),
  provider: publishingProviderSchema,
  status: publishingPostStatusSchema,
  hasMedia: z.boolean(),
  recoverable: z.boolean().optional(),
  mediaAssetIds: z.array(z.uuid()),
})
export const portalPublishingQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    mediaLimit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.from &&
      input.to &&
      new Date(input.from).valueOf() > new Date(input.to).valueOf()
    ) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "La fecha final debe ser posterior a la fecha inicial.",
      })
    }
  })
export const portalPublishingResponseSchema = z.object({
  canView: z.boolean(),
  canManage: z.boolean(),
  focusDate: z.string(),
  accounts: z.array(portalPublishingAccountSchema),
  posts: z.array(portalPublishingPostSchema),
  media: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(["image", "video"]),
      name: z.string(),
      thumbnailStatus: z.enum(["pending", "ready", "failed", "not_applicable"]),
    })
  ),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  mediaLimit: z.number().int().positive(),
  mediaTotal: z.number().int().nonnegative(),
  range: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
})
const portalPublishingPostFields = {
  idempotencyKey: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:~-]*$/),
  content: z.string().trim().min(1).max(10000),
  accountIds: z.array(z.uuid()).min(1).max(20),
  mediaAssetIds: z.array(z.uuid()).max(10).default([]),
  mode: z.enum(["draft", "now", "schedule"]),
  scheduledAt: z.string().datetime().optional(),
}
export const createPortalPublishingPostsSchema = z
  .object(portalPublishingPostFields)
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.accountIds).size !== input.accountIds.length) {
      context.addIssue({
        code: "custom",
        path: ["accountIds"],
        message: "No repitas cuentas destino.",
      })
    }
    if (new Set(input.mediaAssetIds).size !== input.mediaAssetIds.length) {
      context.addIssue({
        code: "custom",
        path: ["mediaAssetIds"],
        message: "No repitas archivos.",
      })
    }
    if (input.mode === "schedule" && !input.scheduledAt) {
      context.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "La fecha programada es obligatoria.",
      })
    }
    if (input.mode !== "schedule" && input.scheduledAt) {
      context.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "La fecha solo aplica al modo programado.",
      })
    }
  })
export const updatePortalPublishingPostSchema = z
  .object({
    content: z.string().trim().min(1).max(10000).optional(),
    mediaAssetIds: z.array(z.uuid()).max(10).optional(),
    mode: z.enum(["draft", "now", "schedule"]).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0)

export const rssSchedulePermissionIds = [
  "rss_schedules.view",
  "rss_schedules.manage",
] as const
export const rssSchedulePermissionIdSchema = z.enum(rssSchedulePermissionIds)

export const portalRssScheduleStatusSchema = z.enum(["active", "paused"])
export const portalRssScheduleWeekdaySchema = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
])
export const portalRssScheduleHistoryResultSchema = z.enum([
  "queued",
  "skipped",
  "failed",
  "published",
])
export const portalRssScheduleRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
])
export const portalRssScheduleRunTriggerSchema = z.enum(["scheduled", "manual"])

const weekdayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
const rssScheduleTimeSlotSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "La hora debe usar el formato HH:mm.")
const rssScheduleTimeSlotsSchema = z
  .array(rssScheduleTimeSlotSchema)
  .min(1, "Incluye al menos un horario.")
  .max(24)
  .refine((slots) => new Set(slots).size === slots.length, {
    message: "Los horarios no se pueden repetir.",
  })
  .transform((slots) => [...slots].sort())
const rssScheduleWeekdaysSchema = z
  .array(portalRssScheduleWeekdaySchema)
  .min(1, "Incluye al menos un día.")
  .max(7)
  .refine((weekdays) => new Set(weekdays).size === weekdays.length, {
    message: "Los días no se pueden repetir.",
  })
  .transform((weekdays) =>
    [...weekdays].sort(
      (left, right) => weekdayOrder.indexOf(left) - weekdayOrder.indexOf(right)
    )
  )
const rssScheduleTargetIdsSchema = z
  .array(z.uuid())
  .min(1, "Selecciona al menos una cuenta.")
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Las cuentas no se pueden repetir.",
  })
const rssScheduleFeedUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .url("La URL del feed no es válida.")
  .refine(
    (value) => {
      const protocol = new URL(value).protocol
      return protocol === "http:" || protocol === "https:"
    },
    { message: "El feed debe usar HTTP o HTTPS." }
  )
const rssScheduleDateSchema = z
  .string()
  .date("La fecha debe usar el formato YYYY-MM-DD.")
const defaultRssScheduleContentRules = {
  includeLink: true,
  includeSummary: true,
  template: "{title}\n\n{summary}\n\nLeer más: {url}",
}
const portalRssScheduleContentRulesSchema = z
  .object({
    includeLink: z
      .boolean()
      .default(defaultRssScheduleContentRules.includeLink),
    includeSummary: z
      .boolean()
      .default(defaultRssScheduleContentRules.includeSummary),
    template: z
      .string()
      .trim()
      .min(1)
      .max(10000)
      .default(defaultRssScheduleContentRules.template),
  })
  .strict()

export const portalRssScheduleTargetSchema = z.object({
  id: z.uuid(),
  socialAccountId: z.uuid(),
  displayName: z.string(),
  providerKey: z.string(),
  connected: z.boolean(),
})
export const portalRssScheduleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  feedUrl: z.string().url(),
  description: z.string(),
  status: portalRssScheduleStatusSchema,
  timezone: profileTimeZoneSchema,
  timeSlots: z.array(rssScheduleTimeSlotSchema),
  weekdays: z.array(portalRssScheduleWeekdaySchema),
  startDate: rssScheduleDateSchema.nullable(),
  endDate: rssScheduleDateSchema.nullable(),
  contentRules: portalRssScheduleContentRulesSchema,
  targets: z.array(portalRssScheduleTargetSchema),
  lastCheckedAt: z.string().datetime().nullable(),
  lastQueuedAt: z.string().datetime().nullable(),
  nextRunAt: z.string().datetime().nullable(),
  queuedCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export const portalRssScheduleHistorySchema = z.object({
  id: z.uuid(),
  rssScheduleId: z.uuid(),
  rssScheduleTargetId: z.uuid(),
  publishingPostId: z.uuid().nullable(),
  targetName: z.string(),
  itemGuid: z.string().nullable(),
  itemUrl: z.string().url().nullable(),
  title: z.string().nullable(),
  result: portalRssScheduleHistoryResultSchema,
  errorCode: z.string().nullable(),
  queuedAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export const portalRssScheduleRunSchema = z.object({
  id: z.uuid(),
  rssScheduleId: z.uuid(),
  trigger: portalRssScheduleRunTriggerSchema,
  status: portalRssScheduleRunStatusSchema,
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  feedItemsRead: z.number().int().nonnegative(),
  queuedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  errorCode: z.string().nullable(),
  createdAt: z.string().datetime(),
})
export const portalRssSchedulesResponseSchema = z.object({
  canView: z.boolean(),
  canManage: z.boolean(),
  schedules: z.array(portalRssScheduleSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})
export const portalRssScheduleHistoriesResponseSchema = z.object({
  histories: z.array(portalRssScheduleHistorySchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})
export const portalRssScheduleRunsResponseSchema = z.object({
  runs: z.array(portalRssScheduleRunSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})
export const portalRssFeedValidationSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  websiteUrl: z.string().url().nullable(),
  itemCount: z.number().int().nonnegative(),
  sampleItems: z.array(
    z.object({
      guid: z.string().nullable(),
      title: z.string().nullable(),
      url: z.string().url().nullable(),
      publishedAt: z.string().datetime().nullable(),
    })
  ),
})

export const portalRssSchedulesQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    status: portalRssScheduleStatusSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
export const portalRssScheduleHistoryQuerySchema = z
  .object({
    result: portalRssScheduleHistoryResultSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
export const portalRssScheduleRunsQuerySchema = z
  .object({
    status: portalRssScheduleRunStatusSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
export const portalRssScheduleIdSchema = z.object({ id: z.uuid() }).strict()
export const validatePortalRssFeedSchema = z
  .object({ feedUrl: rssScheduleFeedUrlSchema })
  .strict()

const portalRssScheduleInputFields = {
  name: z.string().trim().min(1).max(160),
  feedUrl: rssScheduleFeedUrlSchema,
  description: z.string().trim().max(500).default(""),
  status: portalRssScheduleStatusSchema.default("active"),
  timezone: profileTimeZoneSchema,
  timeSlots: rssScheduleTimeSlotsSchema,
  weekdays: rssScheduleWeekdaysSchema,
  startDate: rssScheduleDateSchema.nullable().optional(),
  endDate: rssScheduleDateSchema.nullable().optional(),
  contentRules: portalRssScheduleContentRulesSchema.default(
    defaultRssScheduleContentRules
  ),
  targetSocialAccountIds: rssScheduleTargetIdsSchema,
}

export const createPortalRssScheduleSchema = z
  .object(portalRssScheduleInputFields)
  .strict()
  .superRefine((input, context) => {
    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message:
          "La fecha final debe ser posterior o igual a la fecha inicial.",
      })
    }
  })
export const updatePortalRssScheduleSchema = z
  .object({
    name: portalRssScheduleInputFields.name.optional(),
    feedUrl: portalRssScheduleInputFields.feedUrl.optional(),
    description: z.string().trim().max(500).optional(),
    status: portalRssScheduleStatusSchema.optional(),
    timezone: profileTimeZoneSchema.optional(),
    timeSlots: rssScheduleTimeSlotsSchema.optional(),
    weekdays: rssScheduleWeekdaysSchema.optional(),
    startDate: rssScheduleDateSchema.nullable().optional(),
    endDate: rssScheduleDateSchema.nullable().optional(),
    contentRules: portalRssScheduleContentRulesSchema.optional(),
    targetSocialAccountIds: rssScheduleTargetIdsSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Incluye al menos un campo para actualizar.",
  })
  .superRefine((input, context) => {
    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message:
          "La fecha final debe ser posterior o igual a la fecha inicial.",
      })
    }
  })
export const runPortalRssScheduleSchema = z
  .object({ ignoreHistory: z.boolean().default(false) })
  .strict()

export const adminSystemCheckSchema = z.object({
  key: z.enum(["postgres", "redis"]),
  /** Versión detectada; `null` cuando la dependencia no respondió. */
  version: z.string().nullable(),
  passed: z.boolean(),
})
export const adminSystemRuntimeEntrySchema = z.object({
  key: z.enum(["node", "platform", "memory"]),
  value: z.string(),
})
export const adminSystemInformationSchema = z.object({
  environment: z.string(),
  runtime: z.array(adminSystemRuntimeEntrySchema),
  services: z.array(adminSystemCheckSchema),
  migrationsApplied: z.number().int().nonnegative(),
  uptimeSeconds: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
})

export const portalSupportTicketStatusSchema = z.enum([
  "open",
  "resolved",
  "closed",
])
export const portalSupportCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
})
export const portalSupportTicketSchema = z.object({
  id: z.uuid(),
  category: portalSupportCategorySchema,
  subject: z.string(),
  description: z.string(),
  status: portalSupportTicketStatusSchema,
  commentCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export const portalSupportTicketCommentSchema = z.object({
  id: z.uuid(),
  authorName: z.string(),
  authorRole: z.enum(["requester", "support"]),
  body: z.string(),
  createdAt: z.string().datetime(),
})
export const portalSupportTicketDetailSchema = portalSupportTicketSchema.extend(
  {
    comments: z.array(portalSupportTicketCommentSchema),
  }
)
export const portalSupportTicketsResponseSchema = z.object({
  tickets: z.array(portalSupportTicketSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})
export const portalSupportTicketsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    status: portalSupportTicketStatusSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
export const createPortalSupportTicketSchema = z
  .object({
    categoryId: z.uuid(),
    subject: z.string().trim().min(1).max(250),
    description: z.string().trim().min(1).max(5000),
  })
  .strict()
export const createPortalSupportTicketCommentSchema = z
  .object({ body: z.string().trim().min(1).max(5000) })
  .strict()

export const portalWatermarkTypeSchema = z.enum(["image", "text"])
export const portalWatermarkPositionSchema = z.enum([
  "top-left",
  "top-right",
  "center",
  "bottom-left",
  "bottom-right",
])
export const portalWatermarkTextPresetSchema = z.enum([
  "glass",
  "solid-dark",
  "solid-light",
  "minimal",
])
export const portalWatermarkTextColorSchema = z.enum([
  "brand-gradient",
  "sunset-gradient",
  "ocean-gradient",
  "dark",
  "white",
])
export const portalWatermarkTextWeightSchema = z.enum([
  "medium",
  "semibold",
  "bold",
])
export const portalWatermarkAccountSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  providerKey: z.string(),
  capabilityKey: z.string(),
})
export const portalWatermarkSchema = z.object({
  id: z.uuid(),
  socialAccountId: z.uuid().nullable(),
  type: portalWatermarkTypeSchema,
  imageFileAssetId: z.uuid().nullable(),
  text: z.string().nullable(),
  position: portalWatermarkPositionSchema,
  opacityPercent: z.number().int().min(5).max(100),
  scalePercent: z.number().int().min(5).max(100),
  textPreset: portalWatermarkTextPresetSchema,
  textColor: portalWatermarkTextColorSchema,
  textWeight: portalWatermarkTextWeightSchema,
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
})
export const portalWatermarksResponseSchema = z.object({
  canManage: z.boolean(),
  accounts: z.array(portalWatermarkAccountSchema),
  watermarks: z.array(portalWatermarkSchema),
})
const portalWatermarkInputBase = {
  socialAccountId: z.uuid().nullable().optional(),
  position: portalWatermarkPositionSchema.default("bottom-right"),
  opacityPercent: z.number().int().min(5).max(100).default(72),
  scalePercent: z.number().int().min(5).max(100).default(24),
  textPreset: portalWatermarkTextPresetSchema.default("glass"),
  textColor: portalWatermarkTextColorSchema.default("brand-gradient"),
  textWeight: portalWatermarkTextWeightSchema.default("semibold"),
}
export const createPortalWatermarkSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...portalWatermarkInputBase,
      type: z.literal("image"),
      imageFileAssetId: z.uuid(),
    })
    .strict(),
  z
    .object({
      ...portalWatermarkInputBase,
      type: z.literal("text"),
      text: z.string().trim().min(1).max(1000),
    })
    .strict(),
])
export const updatePortalWatermarkSchema = createPortalWatermarkSchema

export const portalTeamRoleSchema = z.enum(["owner", "admin", "member"])
export const portalTeamInvitationRoleSchema = z.enum(["admin", "member"])
export const portalTeamInvitationDeliveryStatusSchema = z.enum([
  "pending",
  "sent",
  "failed",
])
export const portalTeamAccountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  detail: z.string(),
})
export const portalTeamMemberSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string().email().nullable(),
  role: portalTeamRoleSchema,
  joinedAt: z.string().datetime(),
  accountIds: z.array(z.uuid()),
})
export const portalTeamInvitationSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  role: portalTeamInvitationRoleSchema,
  invitedByName: z.string(),
  createdAt: z.string().datetime(),
  lastSentAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  deliveryStatus: portalTeamInvitationDeliveryStatusSchema,
})
export const previewPortalTeamInvitationSchema = z
  .object({ token: z.string().min(32).max(512) })
  .strict()
export const publicPortalTeamInvitationPreviewSchema = z.object({
  workspaceName: z.string(),
  invitedEmail: z.string().email(),
  role: portalTeamInvitationRoleSchema,
  expiresAt: z.string().datetime(),
  accountExists: z.boolean(),
  status: z.enum(["pending", "accepted"]),
})
export const portalTeamSeatUsageSchema = z.object({
  activeMembers: z.number().int().nonnegative(),
  pendingInvitations: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive().nullable(),
})
export const portalTeamsResponseSchema = z.object({
  canManage: z.boolean(),
  canInviteAdmin: z.boolean(),
  canViewActivity: z.boolean(),
  accounts: z.array(portalTeamAccountSchema),
  currentUserId: z.uuid(),
  currentUserRole: portalTeamRoleSchema,
  invitations: z.array(portalTeamInvitationSchema),
  members: z.array(portalTeamMemberSchema),
  seatUsage: portalTeamSeatUsageSchema,
  workspace: z.object({
    id: z.uuid(),
    name: z.string(),
  }),
})
export const createPortalTeamInvitationSchema = z
  .object({
    email: z.string().trim().email().max(320),
    role: portalTeamInvitationRoleSchema.default("member"),
  })
  .strict()
export const updatePortalTeamMemberRoleSchema = z
  .object({ role: portalTeamRoleSchema })
  .strict()
export const updatePortalTeamMemberAccessSchema = z
  .object({
    role: portalTeamInvitationRoleSchema,
    accountIds: z.array(z.uuid()).max(500),
  })
  .strict()
export const replacePortalTeamAccountGrantsSchema = z
  .object({ accountIds: z.array(z.uuid()).max(500) })
  .strict()
export const acceptPortalTeamInvitationSchema = z
  .object({ token: z.string().min(32).max(512) })
  .strict()
export const transferPortalTeamOwnershipSchema = z
  .object({ targetUserId: z.uuid() })
  .strict()
export const portalTeamActivityCategorySchema = z.enum([
  "all",
  "invitations",
  "members",
  "access",
  "ownership",
])
export const portalTeamActivityEventTypeSchema = z.enum([
  "team.invitation_created",
  "team.invitation_resent",
  "team.invitation_revoked",
  "team.invitation_expired",
  "team.invitation_accepted",
  "team.member_role_updated",
  "team.member_access_updated",
  "team.member_account_grants_replaced",
  "team.member_revoked",
  "team.member_left",
  "team.ownership_transferred",
])
export const portalTeamActivityEventSchema = z.object({
  id: z.uuid(),
  actorName: z.string().nullable(),
  subjectName: z.string().nullable(),
  type: portalTeamActivityEventTypeSchema,
  createdAt: z.string().datetime(),
})
export const portalTeamActivityResponseSchema = z.object({
  events: z.array(portalTeamActivityEventSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})
export const portalTeamActivityQuerySchema = z
  .object({
    category: portalTeamActivityCategorySchema.default("all"),
    q: z.string().trim().max(255).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()

export const portalUpcomingPostStatusSchema = z.enum(["draft", "scheduled"])

export const portalDashboardSchema = z.object({
  metrics: z.array(portalDashboardKpiSchema),
  publishingActivity: z.array(dashboardComparisonPointSchema),
  aiUsage: z.object({
    creditsUsed: z.number().int().nonnegative(),
    days: z.array(dashboardDayCountSchema),
    kinds: z.array(dashboardBreakdownItemSchema),
  }),
  channels: z.array(dashboardBreakdownItemSchema),
  aiTools: z.array(dashboardBreakdownItemSchema),
  upcoming: z.array(
    z.object({
      content: z.string(),
      /** Clave del proveedor, o `none` cuando la publicación no tiene canal. */
      channelKey: z.string(),
      status: portalUpcomingPostStatusSchema,
      date: z.string().nullable(),
    })
  ),
})

const adminDashboardKpiSchema = z.object({
  key: z.enum(["users", "workspaces", "subscriptions", "revenue"]),
  value: z.string(),
  /** Con moneda, `value` es el importe en unidad menor y lo formatea la web. */
  currency: z.string().nullable(),
  change: dashboardKpiChangeSchema,
  descriptionKey: z.enum([
    "usersPreviousWeeks",
    "workspacesPreviousWeeks",
    "activeOrTrial",
    "chargedRecently",
  ]),
})

export const adminPaymentStatusSchema = z.enum([
  "pending",
  "paid",
  "partially_refunded",
  "refunded",
  "failed",
])

export const adminDashboardSchema = z.object({
  metrics: z.array(adminDashboardKpiSchema),
  userGrowth: z.array(dashboardComparisonPointSchema),
  plans: z.array(dashboardBreakdownItemSchema),
  aiActivity: z.object({
    total: z.number().int().nonnegative(),
    days: z.array(dashboardDayCountSchema),
    kinds: z.array(dashboardBreakdownItemSchema),
  }),
  recentPayments: z.array(
    z.object({
      product: z.string(),
      workspace: z.string(),
      status: adminPaymentStatusSchema,
      amountMinor: z.number().int().nonnegative(),
      currency: z.string(),
      date: z.string(),
    })
  ),
})

export const channelStatusSchema = z.enum(["active", "paused"])

export const channelOAuthProviderKeySchema = z.enum(["facebook", "linkedin"])

export const channelAccountSchema = z.object({
  id: z.uuid(),
  providerKey: z.string(),
  capabilityKey: z.string(),
  displayName: z.string(),
  handle: z.string().nullable(),
  profileUrl: z.string().nullable(),
  status: channelStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const channelMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  paused: z.number().int().nonnegative(),
  recent: z.number().int().nonnegative(),
})

export const channelListSchema = z.object({
  canManage: z.boolean(),
  canConnect: z.boolean(),
  readyProviders: z.array(channelOAuthProviderKeySchema),
  metrics: channelMetricsSchema,
  providers: z.array(z.string()),
  accounts: z.array(channelAccountSchema),
})

export const channelListQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
  status: channelStatusSchema.optional(),
  provider: z.string().trim().min(1).max(64).optional(),
  sort: z.enum(["latest", "name"]).optional(),
})

export const createChannelSchema = z.object({
  providerKey: z.string().trim().min(2).max(64),
  capabilityKey: z.string().trim().min(2).max(64),
  displayName: z.string().trim().min(2).max(255),
  handle: z.string().trim().max(255).optional(),
  profileUrl: z.string().trim().url().max(2048).optional(),
})

export const updateChannelSchema = z
  .object({
    displayName: z.string().trim().min(2).max(255).optional(),
    status: channelStatusSchema.optional(),
  })
  .refine(
    (value) => value.displayName !== undefined || value.status !== undefined,
    {
      message: "Incluye al menos un campo para actualizar.",
    }
  )

export const integrationProviderKeySchema = z.enum([
  "facebook",
  "linkedin",
  "tiktok",
  "x",
  "whatsapp-status",
])

export const providerConfigurationFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  secret: z.boolean(),
})

export const providerIntegrationReadinessSchema = z.enum([
  "ready",
  "incomplete",
  "disabled",
])

export const providerIntegrationSchema = z.object({
  providerKey: integrationProviderKeySchema,
  label: z.string(),
  description: z.string(),
  capabilities: z.array(z.string()),
  configurationFields: z.array(providerConfigurationFieldSchema),
  configuredFields: z.number().int().nonnegative(),
  requiredFields: z.number().int().nonnegative(),
  enabled: z.boolean(),
  readiness: providerIntegrationReadinessSchema,
})

export const providerIntegrationsSchema = z.array(providerIntegrationSchema)

const configurationValueSchema = z.string().trim().min(1).max(4096)

export const updateProviderIntegrationSchema = z
  .object({
    enabled: z.boolean().optional(),
    configuration: z
      .record(z.string().regex(/^[a-z][a-zA-Z0-9]*$/), configurationValueSchema)
      .optional(),
  })
  .strict()
  .refine(
    (input) => input.enabled !== undefined || input.configuration !== undefined,
    {
      message: "Se requiere al menos un campo para actualizar la integración.",
    }
  )

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type PublicTurnstileConfiguration = z.infer<
  typeof publicTurnstileConfigurationSchema
>
export type AdminTurnstileConfiguration = z.infer<
  typeof adminTurnstileConfigurationSchema
>
export type UpdateAdminTurnstileConfigurationInput = z.infer<
  typeof updateAdminTurnstileConfigurationSchema
>
export type ActiveWorkspace = z.infer<typeof activeWorkspaceSchema>
export type ActivateAuthWorkspaceInput = z.infer<
  typeof activateAuthWorkspaceSchema
>
export type { SupportedLocale } from "./locale.js"
export type PortalProfile = z.infer<typeof portalProfileSchema>
export type UpdatePortalProfileInput = z.infer<typeof updatePortalProfileSchema>
export type ChangePortalPasswordInput = z.infer<
  typeof changePortalPasswordSchema
>
export type AuthSession = z.infer<typeof authSessionSchema>
export type PlatformAdminAuthSession = z.infer<
  typeof platformAdminAuthSessionSchema
>
export type PortalAuthSession = z.infer<typeof portalAuthSessionSchema>
export type PortalDashboard = z.infer<typeof portalDashboardSchema>
export type AdminDashboard = z.infer<typeof adminDashboardSchema>
export type PortalCaptionSourceType = z.infer<
  typeof portalCaptionSourceTypeSchema
>
export type PortalCaptionStatus = z.infer<typeof portalCaptionStatusSchema>
export type PortalCaption = z.infer<typeof portalCaptionSchema>
export type PortalCaptionMetrics = z.infer<typeof portalCaptionMetricsSchema>
export type PortalCaptionsResponse = z.infer<
  typeof portalCaptionsResponseSchema
>
export type PortalCaptionsQuery = z.infer<typeof portalCaptionsQuerySchema>
export type CreatePortalCaptionInput = z.infer<typeof createPortalCaptionSchema>
export type UpdatePortalCaptionInput = z.infer<typeof updatePortalCaptionSchema>
export type PortalFileKind = z.infer<typeof portalFileKindSchema>
export type PortalFileAsset = z.infer<typeof portalFileAssetSchema>
export type PortalFileFolder = z.infer<typeof portalFileFolderSchema>
export type PortalFilesResponse = z.infer<typeof portalFilesResponseSchema>
export type PortalFilesQuery = z.infer<typeof portalFilesQuerySchema>
export type PortalFileSort = z.infer<typeof portalFileSortSchema>
export type PortalFileSortOrder = z.infer<typeof portalFileSortOrderSchema>
export type CreatePortalFileFolderInput = z.infer<
  typeof createPortalFileFolderSchema
>
export type UpdatePortalFileAssetInput = z.infer<
  typeof updatePortalFileAssetSchema
>
export type StartPortalFileUploadInput = z.infer<
  typeof startPortalFileUploadSchema
>
export type UpdatePortalFileFolderInput = z.infer<
  typeof updatePortalFileFolderSchema
>
export type PublishingProvider = z.infer<typeof publishingProviderSchema>
export type PublishingPostStatus = z.infer<typeof publishingPostStatusSchema>
export type PortalPublishingAccount = z.infer<
  typeof portalPublishingAccountSchema
>
export type PortalPublishingPost = z.infer<typeof portalPublishingPostSchema>
export type PortalPublishingResponse = z.infer<
  typeof portalPublishingResponseSchema
>
export type PortalPublishingQuery = z.infer<typeof portalPublishingQuerySchema>
export type CreatePortalPublishingPostsInput = z.infer<
  typeof createPortalPublishingPostsSchema
>
export type UpdatePortalPublishingPostInput = z.infer<
  typeof updatePortalPublishingPostSchema
>
export type RssSchedulePermissionId = z.infer<
  typeof rssSchedulePermissionIdSchema
>
export type PortalRssScheduleStatus = z.infer<
  typeof portalRssScheduleStatusSchema
>
export type PortalRssScheduleWeekday = z.infer<
  typeof portalRssScheduleWeekdaySchema
>
export type PortalRssScheduleHistoryResult = z.infer<
  typeof portalRssScheduleHistoryResultSchema
>
export type PortalRssScheduleRunStatus = z.infer<
  typeof portalRssScheduleRunStatusSchema
>
export type PortalRssScheduleRunTrigger = z.infer<
  typeof portalRssScheduleRunTriggerSchema
>
export type PortalRssScheduleTarget = z.infer<
  typeof portalRssScheduleTargetSchema
>
export type PortalRssSchedule = z.infer<typeof portalRssScheduleSchema>
export type PortalRssScheduleHistory = z.infer<
  typeof portalRssScheduleHistorySchema
>
export type PortalRssScheduleRun = z.infer<typeof portalRssScheduleRunSchema>
export type PortalRssSchedulesResponse = z.infer<
  typeof portalRssSchedulesResponseSchema
>
export type PortalRssScheduleHistoriesResponse = z.infer<
  typeof portalRssScheduleHistoriesResponseSchema
>
export type PortalRssScheduleRunsResponse = z.infer<
  typeof portalRssScheduleRunsResponseSchema
>
export type PortalRssFeedValidation = z.infer<
  typeof portalRssFeedValidationSchema
>
export type PortalRssSchedulesQuery = z.infer<
  typeof portalRssSchedulesQuerySchema
>
export type PortalRssScheduleHistoryQuery = z.infer<
  typeof portalRssScheduleHistoryQuerySchema
>
export type PortalRssScheduleRunsQuery = z.infer<
  typeof portalRssScheduleRunsQuerySchema
>
export type ValidatePortalRssFeedInput = z.infer<
  typeof validatePortalRssFeedSchema
>
export type CreatePortalRssScheduleInput = z.infer<
  typeof createPortalRssScheduleSchema
>
export type UpdatePortalRssScheduleInput = z.infer<
  typeof updatePortalRssScheduleSchema
>
export type RunPortalRssScheduleInput = z.infer<
  typeof runPortalRssScheduleSchema
>
export type PortalSupportTicketStatus = z.infer<
  typeof portalSupportTicketStatusSchema
>
export type PortalSupportCategory = z.infer<typeof portalSupportCategorySchema>
export type AdminSystemCheck = z.infer<typeof adminSystemCheckSchema>
export type AdminSystemInformation = z.infer<
  typeof adminSystemInformationSchema
>
export type PortalSupportTicket = z.infer<typeof portalSupportTicketSchema>
export type PortalSupportTicketComment = z.infer<
  typeof portalSupportTicketCommentSchema
>
export type PortalSupportTicketDetail = z.infer<
  typeof portalSupportTicketDetailSchema
>
export type PortalSupportTicketsResponse = z.infer<
  typeof portalSupportTicketsResponseSchema
>
export type PortalSupportTicketsQuery = z.infer<
  typeof portalSupportTicketsQuerySchema
>
export type CreatePortalSupportTicketInput = z.infer<
  typeof createPortalSupportTicketSchema
>
export type CreatePortalSupportTicketCommentInput = z.infer<
  typeof createPortalSupportTicketCommentSchema
>
export type PortalWatermarkType = z.infer<typeof portalWatermarkTypeSchema>
export type PortalWatermarkPosition = z.infer<
  typeof portalWatermarkPositionSchema
>
export type PortalWatermarkTextPreset = z.infer<
  typeof portalWatermarkTextPresetSchema
>
export type PortalWatermarkTextColor = z.infer<
  typeof portalWatermarkTextColorSchema
>
export type PortalWatermarkTextWeight = z.infer<
  typeof portalWatermarkTextWeightSchema
>
export type PortalWatermarkAccount = z.infer<
  typeof portalWatermarkAccountSchema
>
export type PortalWatermark = z.infer<typeof portalWatermarkSchema>
export type PortalWatermarksResponse = z.infer<
  typeof portalWatermarksResponseSchema
>
export type CreatePortalWatermarkInput = z.infer<
  typeof createPortalWatermarkSchema
>
export type UpdatePortalWatermarkInput = z.infer<
  typeof updatePortalWatermarkSchema
>
export type PortalTeamRole = z.infer<typeof portalTeamRoleSchema>
export type PortalTeamInvitationRole = z.infer<
  typeof portalTeamInvitationRoleSchema
>
export type PortalTeamInvitationDeliveryStatus = z.infer<
  typeof portalTeamInvitationDeliveryStatusSchema
>
export type PortalTeamAccount = z.infer<typeof portalTeamAccountSchema>
export type PortalTeamMember = z.infer<typeof portalTeamMemberSchema>
export type PortalTeamInvitation = z.infer<typeof portalTeamInvitationSchema>
export type PreviewPortalTeamInvitationInput = z.infer<
  typeof previewPortalTeamInvitationSchema
>
export type PublicPortalTeamInvitationPreview = z.infer<
  typeof publicPortalTeamInvitationPreviewSchema
>
export type PortalTeamSeatUsage = z.infer<typeof portalTeamSeatUsageSchema>
export type PortalTeamsResponse = z.infer<typeof portalTeamsResponseSchema>
export type CreatePortalTeamInvitationInput = z.infer<
  typeof createPortalTeamInvitationSchema
>
export type UpdatePortalTeamMemberRoleInput = z.infer<
  typeof updatePortalTeamMemberRoleSchema
>
export type UpdatePortalTeamMemberAccessInput = z.infer<
  typeof updatePortalTeamMemberAccessSchema
>
export type ReplacePortalTeamAccountGrantsInput = z.infer<
  typeof replacePortalTeamAccountGrantsSchema
>
export type AcceptPortalTeamInvitationInput = z.infer<
  typeof acceptPortalTeamInvitationSchema
>
export type TransferPortalTeamOwnershipInput = z.infer<
  typeof transferPortalTeamOwnershipSchema
>
export type PortalTeamActivityCategory = z.infer<
  typeof portalTeamActivityCategorySchema
>
export type PortalTeamActivityEventType = z.infer<
  typeof portalTeamActivityEventTypeSchema
>
export type PortalTeamActivityEvent = z.infer<
  typeof portalTeamActivityEventSchema
>
export type PortalTeamActivityResponse = z.infer<
  typeof portalTeamActivityResponseSchema
>
export type PortalTeamActivityQuery = z.infer<
  typeof portalTeamActivityQuerySchema
>
export type ChannelStatus = z.infer<typeof channelStatusSchema>
export type ChannelAccount = z.infer<typeof channelAccountSchema>
export type ChannelMetrics = z.infer<typeof channelMetricsSchema>
export type ChannelList = z.infer<typeof channelListSchema>
export type ChannelListQuery = z.infer<typeof channelListQuerySchema>
export type CreateChannelInput = z.infer<typeof createChannelSchema>
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>
export type IntegrationProviderKey = z.infer<
  typeof integrationProviderKeySchema
>
export type ProviderIntegration = z.infer<typeof providerIntegrationSchema>
export type UpdateProviderIntegrationInput = z.infer<
  typeof updateProviderIntegrationSchema
>

export const channelOAuthContextSchema = z
  .record(
    z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-zA-Z0-9]*$/),
    z.string().max(1024)
  )
  .refine((context) => Object.keys(context).length <= 20, {
    message: "El contexto OAuth admite hasta 20 valores.",
  })

export const channelOAuthStartSchema = z
  .object({
    providerKey: z.string().trim().min(2).max(64),
    capabilityKey: z.string().trim().min(2).max(64),
    reconnectAccountId: z.uuid().optional(),
    context: channelOAuthContextSchema.optional(),
  })
  .strict()

export const channelOAuthStateTokenSchema = z
  .string()
  .min(64)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/)

export const channelOAuthStateStatusSchema = z.enum([
  "pending",
  "consumed",
  "expired",
])

export const channelOAuthStartResponseSchema = z.object({
  state: channelOAuthStateTokenSchema,
  providerKey: z.string(),
  capabilityKey: z.string(),
  status: z.literal("pending"),
  expiresAt: z.string().datetime(),
})

export const channelOAuthStateResponseSchema = z.object({
  providerKey: z.string(),
  capabilityKey: z.string(),
  status: channelOAuthStateStatusSchema,
  expiresAt: z.string().datetime(),
})

export const channelOAuthConnectQuerySchema = z
  .object({
    capabilityKey: z.string().trim().min(2).max(64),
    reconnectAccountId: z.uuid().optional(),
    context: channelOAuthContextSchema.optional(),
  })
  .strict()

export const channelOAuthCallbackQuerySchema = z
  .object({
    state: channelOAuthStateTokenSchema,
    code: z.string().trim().min(1).max(8192).optional(),
    error: z.string().trim().min(1).max(256).optional(),
    error_description: z.string().trim().max(1024).optional(),
  })
  .passthrough()

export const channelOAuthCallbackOutcomeSchema = z.enum([
  "authorized",
  "denied",
  "failed",
])

export const webAuditEventSchema = z
  .object({
    event: z.string().trim().min(3).max(160),
    severity: z.enum(["success", "warning", "error"]),
    outcome: z.string().trim().min(1).max(32),
    pagePath: z.string().trim().startsWith("/").max(512).optional(),
    requestId: z.string().trim().max(128).optional(),
    errorCode: z.string().trim().max(96).optional(),
    summary: z.string().trim().max(500).optional(),
    metadata: z
      .record(
        z.string().max(64),
        z.union([z.string(), z.number(), z.boolean(), z.null()])
      )
      .refine((value) => Object.keys(value).length <= 20)
      .optional(),
  })
  .strict()

export type WebAuditEvent = z.infer<typeof webAuditEventSchema>

export const adminAuditEventSchema = z.object({
  id: z.uuid(),
  source: z.enum(["web", "api", "worker"]),
  event: z.string(),
  severity: z.enum(["success", "warning", "error"]),
  outcome: z.string(),
  summary: z.string().nullable(),
  errorCode: z.string().nullable(),
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
  workspaceName: z.string().nullable(),
  service: z.string().nullable(),
  commitSha: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export const adminAuditEventsResponseSchema = z.object({
  events: z.array(adminAuditEventSchema),
})

export type AdminAuditEvent = z.infer<typeof adminAuditEventSchema>
export type AdminAuditEventsResponse = z.infer<
  typeof adminAuditEventsResponseSchema
>

export type ChannelOAuthContext = z.infer<typeof channelOAuthContextSchema>
export type ChannelOAuthStart = z.infer<typeof channelOAuthStartSchema>
export type ChannelOAuthStateStatus = z.infer<
  typeof channelOAuthStateStatusSchema
>
export type ChannelOAuthStartResponse = z.infer<
  typeof channelOAuthStartResponseSchema
>
export type ChannelOAuthStateResponse = z.infer<
  typeof channelOAuthStateResponseSchema
>
export type ChannelOAuthProviderKey = z.infer<
  typeof channelOAuthProviderKeySchema
>
export type ChannelOAuthConnectQuery = z.infer<
  typeof channelOAuthConnectQuerySchema
>
export type ChannelOAuthCallbackQuery = z.infer<
  typeof channelOAuthCallbackQuerySchema
>
export type ChannelOAuthCallbackOutcome = z.infer<
  typeof channelOAuthCallbackOutcomeSchema
>

export * from "./channels-v2.js"

export * from "./admin-integrations.js"

export * from "./google-drive.js"

export * from "./email.js"

export * from "./admin-plans.js"

export * from "./admin-content.js"

export * from "./admin-settings.js"

export * from "./link-bio.js"

export * from "./admin-operations.js"

export * from "./admin-support.js"

export * from "./admin-payment-report.js"

export * from "./notifications.js"

export * from "./admin-manual-payments.js"

export * from "./admin-email-templates.js"

export * from "./public-site.js"

export * from "./portal-core-v2.js"

export * from "./ai-v2.js"

export * from "./commerce-v2.js"

export * from "./online-media-v2.js"
