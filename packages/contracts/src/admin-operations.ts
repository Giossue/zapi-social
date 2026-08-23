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

/**
 * Una celda trae el dato de una de estas formas, nunca de dos:
 * `primary` para texto literal, `primaryKey` para clasificación traducible, o
 * uno de los valores tipados, que la interfaz formatea con el idioma activo.
 * Los tipados existen porque una fecha o un importe compuestos en el servidor
 * llevarían el formato de un idioma fijo.
 */
export const adminOperationCellSchema = z.object({
  /** Dato literal. Queda vacío cuando la celda se resuelve de otra forma. */
  primary: z.string(),
  /** Clasificación o texto fijo: la interfaz lo traduce en vez de `primary`. */
  primaryKey: z.string().optional(),
  primaryArgs: z.record(z.string(), z.string()).optional(),
  /**
   * Valor tipado. Si además hay `primaryKey`, la interfaz lo formatea y lo
   * pasa al mensaje como `{value}`; si no, lo muestra tal cual.
   */
  primaryNumber: z.number().optional(),
  primaryDate: z.string().datetime().optional(),
  primaryMoney: z
    .object({ amountMinor: z.number(), currency: z.string() })
    .optional(),
  secondary: z.string().optional(),
  mono: z.boolean().optional(),
})

export const adminOperationActionSchema = z.object({
  key: adminOperationActionKeySchema,
  /** Clave del rótulo: varias acciones comparten `key` con textos distintos. */
  labelKey: z.string(),
  kind: z.enum(["destructive", "success"]).optional(),
})

export const adminOperationRowSchema = z.object({
  id: z.uuid(),
  cells: z.array(adminOperationCellSchema),
  /** Clave del estado; también es el valor con el que la cola filtra. */
  statusKey: z.string(),
  tone: adminOperationToneSchema,
  actions: z.array(adminOperationActionSchema),
})

export const adminOperationMetricSchema = z.object({
  /** Clave `<módulo>.<pestaña>.<métrica>`; la interfaz pone rótulo y detalle. */
  key: z.string(),
  /** Valor ya compuesto (porcentajes); vacío si viene tipado. */
  value: z.string(),
  numberValue: z.number().optional(),
  moneyValue: z
    .object({ amountMinor: z.number(), currency: z.string() })
    .optional(),
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
  messageKey: z.string(),
})

export const polarEnvironmentSchema = z.enum(["sandbox", "live"])
export const polarIntegrationReadinessSchema = z.enum([
  "ready",
  "incomplete",
  "untested",
  "disabled",
])

export const polarIntegrationSchema = z.object({
  enabled: z.boolean(),
  configured: z.boolean(),
  readiness: polarIntegrationReadinessSchema,
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
  lastTestedAt: z.string().datetime().nullable(),
})

export const polarConfigurationDraftSchema = z
  .object({
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

export const testPolarIntegrationSchema = z
  .object({ configuration: polarConfigurationDraftSchema })
  .strict()

export const testPolarIntegrationResponseSchema = z.object({
  testedAt: z.string().datetime(),
})

export const updatePolarIntegrationSchema = polarConfigurationDraftSchema
  .extend({ enabled: z.boolean() })
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
export type PolarConfigurationDraft = z.infer<
  typeof polarConfigurationDraftSchema
>
export type TestPolarIntegrationInput = z.infer<
  typeof testPolarIntegrationSchema
>
export type TestPolarIntegrationResponse = z.infer<
  typeof testPolarIntegrationResponseSchema
>
export type UpdatePolarIntegrationInput = z.infer<
  typeof updatePolarIntegrationSchema
>
