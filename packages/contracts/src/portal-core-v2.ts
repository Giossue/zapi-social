import { z } from "zod"

const pageFields = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}

export const portalGroupStatusSchema = z.enum(["active", "inactive"])
export const portalGroupAccountSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  providerKey: z.string(),
  capabilityKey: z.string(),
  avatarUrl: z.string().nullable(),
})
export const portalAccountGroupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  color: z.string().regex(/^#[0-9a-f]{6}$/),
  status: portalGroupStatusSchema,
  accountIds: z.array(z.uuid()),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
})
export const portalGroupsResponseSchema = z.object({
  canManage: z.boolean(),
  accounts: z.array(portalGroupAccountSchema),
  groups: z.array(portalAccountGroupSchema),
  metrics: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    inactive: z.number().int().nonnegative(),
    reachedAccounts: z.number().int().nonnegative(),
  }),
})
export const portalGroupsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    status: portalGroupStatusSchema.optional(),
  })
  .strict()
const portalAccountGroupInputFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  color: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/),
  status: portalGroupStatusSchema.default("active"),
  accountIds: z
    .array(z.uuid())
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length),
}
export const createPortalAccountGroupSchema = z
  .object(portalAccountGroupInputFields)
  .strict()
export const updatePortalAccountGroupSchema = z
  .object({
    name: portalAccountGroupInputFields.name.optional(),
    description: z.string().trim().max(1000).optional(),
    color: portalAccountGroupInputFields.color.optional(),
    status: portalGroupStatusSchema.optional(),
    accountIds: portalAccountGroupInputFields.accountIds.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0)

export const portalBulkPostBatchStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
])
export const portalBulkPostRowStatusSchema = z.enum([
  "pending",
  "valid",
  "invalid",
  "processed",
  "failed",
])
export const portalBulkPostBatchSchema = z.object({
  id: z.uuid(),
  sourceFileAssetId: z.uuid(),
  sourceFileName: z.string(),
  status: portalBulkPostBatchStatusSchema,
  intervalMinutes: z.number().int().min(1).max(10080),
  timezone: z.string(),
  targetAccountIds: z.array(z.uuid()),
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  invalidRows: z.number().int().nonnegative(),
  createdPosts: z.number().int().nonnegative(),
  failedRows: z.number().int().nonnegative(),
  errorCode: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export const portalBulkPostRowSchema = z.object({
  id: z.uuid(),
  rowNumber: z.number().int().positive(),
  status: portalBulkPostRowStatusSchema,
  payload: z.record(z.string(), z.string()),
  validationErrors: z.array(z.string()),
  publishingPostIds: z.array(z.uuid()),
  processedAt: z.string().datetime().nullable(),
})
export const portalBulkPostBatchesResponseSchema = z.object({
  batches: z.array(portalBulkPostBatchSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})
export const portalBulkPostBatchDetailSchema = z.object({
  batch: portalBulkPostBatchSchema,
  rows: z.array(portalBulkPostRowSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})
export const portalBulkPostBatchesQuerySchema = z
  .object({
    status: portalBulkPostBatchStatusSchema.optional(),
    ...pageFields,
  })
  .strict()
export const portalBulkPostRowsQuerySchema = z
  .object({
    status: portalBulkPostRowStatusSchema.optional(),
    ...pageFields,
  })
  .strict()
export const createPortalBulkPostBatchSchema = z
  .object({
    sourceFileAssetId: z.uuid(),
    targetSocialAccountIds: z
      .array(z.uuid())
      .min(1)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length),
    intervalMinutes: z.number().int().min(1).max(10080).default(60),
    timezone: z.string().trim().min(1).max(64),
  })
  .strict()

export const automationPermissionSchema = z.enum([
  "accounts:read",
  "posts:read",
  "posts:write",
])
export const automationWebhookEventSchema = z.enum([
  "post.created",
  "post.published",
  "post.failed",
])
export const portalAutomationApiKeySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  tokenPrefix: z.string(),
  permissions: z.array(automationPermissionSchema),
  status: z.enum(["active", "revoked"]),
  lastUsedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export const portalAutomationWebhookSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  url: z.string().url(),
  events: z.array(automationWebhookEventSchema),
  enabled: z.boolean(),
  lastSentAt: z.string().datetime().nullable(),
  lastStatusCode: z.number().int().nullable(),
  createdAt: z.string().datetime(),
})
export const portalAutomationLogSchema = z.object({
  id: z.uuid(),
  direction: z.enum(["inbound", "outbound"]),
  event: z.string(),
  status: z.enum(["accepted", "succeeded", "failed"]),
  statusCode: z.number().int().nullable(),
  summary: z.string().nullable(),
  createdAt: z.string().datetime(),
})
export const portalAutomationResponseSchema = z.object({
  canManage: z.boolean(),
  apiKeys: z.array(portalAutomationApiKeySchema),
  webhooks: z.array(portalAutomationWebhookSchema),
  logs: z.array(portalAutomationLogSchema),
})
export const createPortalAutomationApiKeySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    permissions: z
      .array(automationPermissionSchema)
      .min(1)
      .refine((values) => new Set(values).size === values.length),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict()
export const createdPortalAutomationApiKeySchema = z.object({
  apiKey: portalAutomationApiKeySchema,
  token: z.string().min(32),
})
export const createPortalAutomationWebhookSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    url: z.string().trim().url().max(2048),
    events: z
      .array(automationWebhookEventSchema)
      .min(1)
      .refine((values) => new Set(values).size === values.length),
  })
  .strict()
export const updatePortalAutomationWebhookSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    url: z.string().trim().url().max(2048).optional(),
    events: z
      .array(automationWebhookEventSchema)
      .min(1)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
    enabled: z.boolean().optional(),
    rotateSecret: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0)
export const updatedPortalAutomationWebhookSchema = z.object({
  webhook: portalAutomationWebhookSchema,
  signingSecret: z.string().nullable(),
})

export const automationIdentitySchema = z.object({
  workspaceId: z.uuid(),
  permissions: z.array(automationPermissionSchema),
})
export const automationAccountSchema = portalGroupAccountSchema.extend({
  status: z.string(),
})
export const automationCreatePostsSchema = z
  .object({
    accountIds: z
      .array(z.uuid())
      .min(1)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length),
    content: z.string().trim().max(10000).default(""),
    fileAssetIds: z
      .array(z.uuid())
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length)
      .default([]),
    mode: z.enum(["draft", "scheduled", "publish_now"]).default("scheduled"),
    scheduledAt: z.string().datetime().nullable().optional(),
    externalReference: z.string().trim().max(255).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.mode === "scheduled" && !input.scheduledAt) {
      context.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "La fecha programada es obligatoria.",
      })
    }
    if (input.content.length === 0 && input.fileAssetIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["content"],
        message: "Incluye contenido o al menos un archivo.",
      })
    }
  })
export const automationPostSchema = z.object({
  id: z.uuid(),
  socialAccountId: z.uuid(),
  status: z.enum(["draft", "scheduled", "processing", "published", "failed"]),
  scheduledAt: z.string().datetime().nullable(),
})

export type PortalGroupStatus = z.infer<typeof portalGroupStatusSchema>
export type PortalGroupAccount = z.infer<typeof portalGroupAccountSchema>
export type PortalAccountGroup = z.infer<typeof portalAccountGroupSchema>
export type PortalGroupsResponse = z.infer<typeof portalGroupsResponseSchema>
export type PortalGroupsQuery = z.infer<typeof portalGroupsQuerySchema>
export type CreatePortalAccountGroupInput = z.infer<
  typeof createPortalAccountGroupSchema
>
export type UpdatePortalAccountGroupInput = z.infer<
  typeof updatePortalAccountGroupSchema
>
export type PortalBulkPostBatch = z.infer<typeof portalBulkPostBatchSchema>
export type PortalBulkPostRow = z.infer<typeof portalBulkPostRowSchema>
export type PortalBulkPostBatchesResponse = z.infer<
  typeof portalBulkPostBatchesResponseSchema
>
export type PortalBulkPostBatchDetail = z.infer<
  typeof portalBulkPostBatchDetailSchema
>
export type PortalBulkPostBatchesQuery = z.infer<
  typeof portalBulkPostBatchesQuerySchema
>
export type PortalBulkPostRowsQuery = z.infer<
  typeof portalBulkPostRowsQuerySchema
>
export type CreatePortalBulkPostBatchInput = z.infer<
  typeof createPortalBulkPostBatchSchema
>
export type AutomationPermission = z.infer<typeof automationPermissionSchema>
export type AutomationWebhookEvent = z.infer<
  typeof automationWebhookEventSchema
>
export type PortalAutomationResponse = z.infer<
  typeof portalAutomationResponseSchema
>
export type CreatePortalAutomationApiKeyInput = z.infer<
  typeof createPortalAutomationApiKeySchema
>
export type CreatedPortalAutomationApiKey = z.infer<
  typeof createdPortalAutomationApiKeySchema
>
export type CreatePortalAutomationWebhookInput = z.infer<
  typeof createPortalAutomationWebhookSchema
>
export type UpdatePortalAutomationWebhookInput = z.infer<
  typeof updatePortalAutomationWebhookSchema
>
export type UpdatedPortalAutomationWebhook = z.infer<
  typeof updatedPortalAutomationWebhookSchema
>
export type AutomationIdentity = z.infer<typeof automationIdentitySchema>
export type AutomationAccount = z.infer<typeof automationAccountSchema>
export type AutomationCreatePostsInput = z.infer<
  typeof automationCreatePostsSchema
>
export type AutomationPost = z.infer<typeof automationPostSchema>
