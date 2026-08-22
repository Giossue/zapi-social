import { z } from "zod"

export const adminPaymentReportRangeSchema = z.enum(["30d", "90d", "12m"])
export const adminPaymentReportProductSchema = z.enum([
  "all",
  "plan",
  "credits",
])

export const adminPaymentReportQuerySchema = z
  .object({
    range: adminPaymentReportRangeSchema.default("30d"),
    productType: adminPaymentReportProductSchema.default("all"),
  })
  .strict()

/** Todos los importes viajan en unidades menores de la moneda (centavos). */
export const adminPaymentReportMetricsSchema = z.object({
  grossMinor: z.number().int().nonnegative(),
  refundedMinor: z.number().int().nonnegative(),
  netMinor: z.number().int(),
  averageTicketMinor: z.number().int().nonnegative(),
  paidCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  refundedCount: z.number().int().nonnegative(),
})

export const adminPaymentReportPeriodSchema = z.object({
  /** `YYYY-MM-DD` en rangos por día, `YYYY-MM` en el rango de 12 meses. */
  period: z.string(),
  grossMinor: z.number().int().nonnegative(),
  netMinor: z.number().int(),
  count: z.number().int().nonnegative(),
})

export const adminPaymentReportProductRowSchema = z.object({
  label: z.string(),
  productType: z.enum(["plan", "credits"]),
  grossMinor: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
})

export const adminPaymentReportStatusRowSchema = z.object({
  status: z.enum(["pending", "paid", "partially_refunded", "refunded", "failed"]),
  amountMinor: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
})

export const adminPaymentReportWorkspaceRowSchema = z.object({
  workspaceId: z.uuid(),
  workspaceName: z.string(),
  grossMinor: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
})

export const adminPaymentReportSchema = z.object({
  range: adminPaymentReportRangeSchema,
  productType: adminPaymentReportProductSchema,
  /** Moneda dominante del periodo; la respuesta agrega solo esa moneda. */
  currency: z.string(),
  currencies: z.array(z.string()),
  metrics: adminPaymentReportMetricsSchema,
  series: z.array(adminPaymentReportPeriodSchema),
  byProduct: z.array(adminPaymentReportProductRowSchema),
  byStatus: z.array(adminPaymentReportStatusRowSchema),
  topWorkspaces: z.array(adminPaymentReportWorkspaceRowSchema),
  generatedAt: z.string().datetime(),
})

export type AdminPaymentReportRange = z.infer<
  typeof adminPaymentReportRangeSchema
>
export type AdminPaymentReportProduct = z.infer<
  typeof adminPaymentReportProductSchema
>
export type AdminPaymentReportQuery = z.infer<
  typeof adminPaymentReportQuerySchema
>
export type AdminPaymentReportMetrics = z.infer<
  typeof adminPaymentReportMetricsSchema
>
export type AdminPaymentReportPeriod = z.infer<
  typeof adminPaymentReportPeriodSchema
>
export type AdminPaymentReportProductRow = z.infer<
  typeof adminPaymentReportProductRowSchema
>
export type AdminPaymentReportStatusRow = z.infer<
  typeof adminPaymentReportStatusRowSchema
>
export type AdminPaymentReportWorkspaceRow = z.infer<
  typeof adminPaymentReportWorkspaceRowSchema
>
export type AdminPaymentReport = z.infer<typeof adminPaymentReportSchema>
