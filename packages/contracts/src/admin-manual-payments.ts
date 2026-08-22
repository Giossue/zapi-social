import { z } from "zod"

export const manualPaymentStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
])

export const adminManualPaymentSchema = z.object({
  id: z.uuid(),
  workspace: z.object({ id: z.uuid(), name: z.string() }),
  user: z.object({
    id: z.uuid(),
    displayName: z.string(),
    email: z.string(),
  }),
  productType: z.enum(["plan", "credits"]),
  productLabel: z.string(),
  reference: z.string(),
  paymentInfo: z.string(),
  note: z.string(),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string(),
  status: manualPaymentStatusSchema,
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export const adminManualPaymentsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    status: z
      .enum(["all", "pending", "approved", "rejected"])
      .default("all"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

export const adminManualPaymentMetricsSchema = z.object({
  pending: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  approvedAmountMinor: z.number().int().nonnegative(),
  currency: z.string(),
})

export const manualPaymentSettingsSchema = z.object({
  enabled: z.boolean(),
  referencePrefix: z.string(),
  instructions: z.string(),
})

export const updateManualPaymentSettingsSchema = z
  .object({
    enabled: z.boolean(),
    referencePrefix: z.string().trim().max(24),
    instructions: z.string().trim().max(4000),
  })
  .strict()

export const adminManualPaymentsResponseSchema = z.object({
  payments: z.array(adminManualPaymentSchema),
  metrics: adminManualPaymentMetricsSchema,
  settings: manualPaymentSettingsSchema,
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

export const adminManualPaymentOptionSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string(),
})

export const adminManualPaymentOptionsSchema = z.object({
  workspaces: z.array(z.object({ id: z.uuid(), label: z.string() })),
  plans: z.array(adminManualPaymentOptionSchema),
  creditPackages: z.array(adminManualPaymentOptionSchema),
})

export const adminManualPaymentOptionsQuerySchema = z
  .object({ q: z.string().trim().min(1).max(255).optional() })
  .strict()

export const createAdminManualPaymentSchema = z
  .object({
    workspaceId: z.uuid(),
    productType: z.enum(["plan", "credits"]),
    planId: z.uuid().nullable().optional(),
    creditPackageId: z.uuid().nullable().optional(),
    amountMinor: z.number().int().positive(),
    currency: z.string().trim().length(3).toUpperCase().default("USD"),
    reference: z.string().trim().min(1).max(190),
    paymentInfo: z.string().trim().max(2000).default(""),
    note: z.string().trim().max(2000).default(""),
  })
  .strict()
  .superRefine((values, context) => {
    if (values.productType === "plan" && !values.planId) {
      context.addIssue({
        code: "custom",
        path: ["planId"],
        message: "Selecciona el plan que cubre este pago.",
      })
    }
    if (values.productType === "credits" && !values.creditPackageId) {
      context.addIssue({
        code: "custom",
        path: ["creditPackageId"],
        message: "Selecciona el paquete de créditos que cubre este pago.",
      })
    }
  })

export type ManualPaymentStatus = z.infer<typeof manualPaymentStatusSchema>
export type AdminManualPayment = z.infer<typeof adminManualPaymentSchema>
export type AdminManualPaymentsQuery = z.infer<
  typeof adminManualPaymentsQuerySchema
>
export type AdminManualPaymentMetrics = z.infer<
  typeof adminManualPaymentMetricsSchema
>
export type ManualPaymentSettings = z.infer<typeof manualPaymentSettingsSchema>
export type UpdateManualPaymentSettingsInput = z.infer<
  typeof updateManualPaymentSettingsSchema
>
export type AdminManualPaymentsResponse = z.infer<
  typeof adminManualPaymentsResponseSchema
>
export type AdminManualPaymentOptions = z.infer<
  typeof adminManualPaymentOptionsSchema
>
export type CreateAdminManualPaymentInput = z.infer<
  typeof createAdminManualPaymentSchema
>
