import { z } from "zod"

const passwordPolicy = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(128)
  .regex(/[A-Z]/, "La contraseña debe incluir una mayúscula.")
  .regex(/[a-z]/, "La contraseña debe incluir una minúscula.")
  .regex(/[0-9]/, "La contraseña debe incluir un número.")
  .regex(/[^A-Za-z0-9]/, "La contraseña debe incluir un carácter especial.")

export const registerSchema = z.object({
  email: z.string().trim().email().max(320),
  password: passwordPolicy,
  displayName: z.string().trim().min(2).max(160),
})

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
})

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

export const portalProfileSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  email: z.string().email(),
  username: z.string().nullable(),
  emailVerifiedAt: z.string().datetime().nullable(),
  locale: z.enum(["es", "en"]).nullable(),
  timezone: profileTimeZoneSchema.nullable(),
  createdAt: z.string().datetime(),
})

export const updatePortalProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(160),
    locale: z.enum(["es", "en"]).nullable(),
    timezone: profileTimeZoneSchema.nullable(),
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
})

export const activeWorkspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  role: z.string(),
})

export const platformAdminAuthSessionSchema = z.object({
  user: authUserSchema,
  area: z.literal("admin"),
})

export const portalAuthSessionSchema = z.object({
  user: authUserSchema,
  area: z.literal("portal"),
  workspace: activeWorkspaceSchema,
})

export const authSessionSchema = z.discriminatedUnion("area", [
  platformAdminAuthSessionSchema,
  portalAuthSessionSchema,
])

const dashboardActionSchema = z.object({
  label: z.string(),
  href: z.string(),
})

const dashboardMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  description: z.string().optional(),
  icon: z.enum(["ai", "calendar", "channels", "files", "storage", "templates"]),
})

const dashboardToolSchema = dashboardActionSchema.extend({
  uses: z.number().int().nonnegative(),
  icon: z.enum(["content", "image", "repurpose", "timing"]),
})

const dashboardAttentionSchema = dashboardActionSchema.extend({
  description: z.string(),
  icon: z.enum(["ai", "channels", "credits", "publishing"]),
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
export const portalFileStatusSchema = z.enum(["pending", "ready", "trashed"])
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
})
export const portalFileFolderSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  fileCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
})
export const portalFilesResponseSchema = z.object({
  canManage: z.boolean(),
  folders: z.array(portalFileFolderSchema),
  files: z.array(portalFileAssetSchema),
})
export const portalFilesQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    folderId: z.uuid().optional(),
    kind: portalFileKindSchema.optional(),
    starred: z.coerce.boolean().optional(),
  })
  .strict()
export const createPortalFileFolderSchema = z
  .object({ name: z.string().trim().min(1).max(160) })
  .strict()
export const updatePortalFileFolderSchema = createPortalFileFolderSchema
export const updatePortalFileAssetSchema = z
  .object({
    starred: z.boolean().optional(),
    folderId: z.uuid().nullable().optional(),
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

export const portalDashboardSchema = z.object({
  welcome: z.object({ name: z.string() }),
  primaryAction: dashboardActionSchema,
  workspace: z.array(dashboardMetricSchema),
  tools: z.array(dashboardToolSchema),
  publishing: z.array(dashboardMetricSchema),
  library: z.array(dashboardMetricSchema),
  attention: z.array(dashboardAttentionSchema),
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
export type CreatePortalFileFolderInput = z.infer<
  typeof createPortalFileFolderSchema
>
export type UpdatePortalFileAssetInput = z.infer<
  typeof updatePortalFileAssetSchema
>
export type StartPortalFileUploadInput = z.infer<
  typeof startPortalFileUploadSchema
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

export * from "./email.js"

export * from "./admin-plans.js"
