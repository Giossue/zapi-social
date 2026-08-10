import { z } from "zod"

export const adminOperationModuleSchema = z.enum([
  "users",
  "credits",
  "affiliate",
  "coupons",
  "payments",
  "subscriptions",
])

export const adminOperationQuerySchema = z
  .object({
    tab: z.string().trim().min(1).max(32),
    q: z.string().trim().max(255).optional(),
    status: z.string().trim().max(48).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(10),
  })
  .strict()

export const adminOperationToneSchema = z.enum([
  "success",
  "warning",
  "neutral",
  "destructive",
])

export const adminOperationActionKeySchema = z.enum([
  "view",
  "edit",
  "deactivate",
  "reactivate",
  "duplicate",
  "remove",
  "approve",
  "reject",
  "mark_paid",
  "refund",
  "sync",
  "cancel_period_end",
  "uncancel",
  "revoke",
])

export const adminOperationCellSchema = z.object({
  primary: z.string(),
  secondary: z.string().optional(),
  mono: z.boolean().optional(),
})

export const adminOperationActionSchema = z.object({
  key: adminOperationActionKeySchema,
  label: z.string(),
  kind: z.enum(["destructive", "success"]).optional(),
})

export const adminOperationRowSchema = z.object({
  id: z.uuid(),
  cells: z.array(adminOperationCellSchema),
  status: z.string(),
  tone: adminOperationToneSchema,
  actions: z.array(adminOperationActionSchema),
})

export const adminOperationMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  description: z.string(),
})

export const adminOperationViewSchema = z.object({
  metrics: z.array(adminOperationMetricSchema),
  rows: z.array(adminOperationRowSchema),
  statusOptions: z.array(z.string()),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    pageCount: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    rangeStart: z.number().int().nonnegative(),
    rangeEnd: z.number().int().nonnegative(),
  }),
})

export const createAdminOperationResourceSchema = z
  .object({ values: z.array(z.string().trim().max(500)).min(1).max(12) })
  .strict()

export const runAdminOperationActionSchema = z
  .object({
    action: adminOperationActionKeySchema,
    values: z.array(z.string().trim().max(500)).max(12).optional(),
  })
  .strict()

export const adminOperationMutationResultSchema = z.object({
  success: z.literal(true),
  message: z.string(),
})

export const polarEnvironmentSchema = z.enum(["sandbox", "live"])

export const polarIntegrationSchema = z.object({
  enabled: z.boolean(),
  configured: z.boolean(),
  environment: polarEnvironmentSchema,
  recurring: z.boolean(),
  monthlyProductId: z.string(),
  yearlyProductId: z.string(),
  oneTimeProductId: z.string(),
  discountCodes: z.boolean(),
  billingAddress: z.boolean(),
  hasAccessToken: z.boolean(),
  hasWebhookSecret: z.boolean(),
  webhookUrl: z.string().url(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
})

export const updatePolarIntegrationSchema = z
  .object({
    enabled: z.boolean(),
    environment: polarEnvironmentSchema,
    recurring: z.boolean(),
    monthlyProductId: z.string().trim().max(160),
    yearlyProductId: z.string().trim().max(160),
    oneTimeProductId: z.string().trim().max(160),
    discountCodes: z.boolean(),
    billingAddress: z.boolean(),
    accessToken: z.string().trim().max(500).optional(),
    webhookSecret: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.enabled &&
      value.recurring &&
      (!value.monthlyProductId || !value.yearlyProductId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["monthlyProductId"],
        message: "Configura los productos recurrentes.",
      })
    }
  })

export type AdminOperationModule = z.infer<typeof adminOperationModuleSchema>
export type AdminOperationQuery = z.infer<typeof adminOperationQuerySchema>
export type AdminOperationActionKey = z.infer<
  typeof adminOperationActionKeySchema
>
export type AdminOperationView = z.infer<typeof adminOperationViewSchema>
export type CreateAdminOperationResourceInput = z.infer<
  typeof createAdminOperationResourceSchema
>
export type RunAdminOperationActionInput = z.infer<
  typeof runAdminOperationActionSchema
>
export type AdminOperationMutationResult = z.infer<
  typeof adminOperationMutationResultSchema
>
export type PolarIntegration = z.infer<typeof polarIntegrationSchema>
export type UpdatePolarIntegrationInput = z.infer<
  typeof updatePolarIntegrationSchema
>
