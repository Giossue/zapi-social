import { z } from "zod"

export const commercePeriodSchema = z.enum(["month", "quarter", "year"])
export const commerceChannelSchema = z.enum(["social", "store", "marketplace"])
export const commerceOrderStatusSchema = z.enum([
  "processing",
  "completed",
  "attention",
  "cancelled",
])
export const portalCommerceQuerySchema = z
  .object({
    period: commercePeriodSchema.default("month"),
    channel: z.enum(["all", ...commerceChannelSchema.options]).default("all"),
  })
  .strict()
export const portalCommerceInventoryItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sku: z.string(),
  available: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative(),
  status: z.enum(["healthy", "low", "out"]),
})
export const portalCommerceOrderSchema = z.object({
  id: z.uuid(),
  customerName: z.string(),
  channel: commerceChannelSchema,
  itemCount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  totalMinor: z.number().int().nonnegative(),
  status: commerceOrderStatusSchema,
  orderedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export const portalCommerceDashboardSchema = z.object({
  canView: z.boolean(),
  canManage: z.boolean(),
  period: commercePeriodSchema,
  channel: z.enum(["all", ...commerceChannelSchema.options]),
  metrics: z.object({
    currency: z.string().length(3),
    salesMinor: z.number().int().nonnegative(),
    orderCount: z.number().int().nonnegative(),
    averageOrderMinor: z.number().int().nonnegative(),
    openReturnCount: z.number().int().nonnegative(),
  }),
  inventory: z.array(portalCommerceInventoryItemSchema),
  orders: z.array(portalCommerceOrderSchema),
})
export const portalCommerceProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sku: z.string(),
  description: z.string(),
  status: z.enum(["active", "inactive"]),
  available: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
const commerceProductFields = {
  name: z.string().trim().min(1).max(240),
  sku: z
    .string()
    .trim()
    .min(1)
    .max(96)
    .regex(/^[A-Za-z0-9._-]+$/),
  description: z.string().trim().max(10_000).default(""),
  status: z.enum(["active", "inactive"]).default("active"),
  available: z.number().int().nonnegative().default(0),
  reserved: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
}
export const createPortalCommerceProductSchema = z
  .object(commerceProductFields)
  .strict()
export const updatePortalCommerceProductSchema = z
  .object({
    name: commerceProductFields.name.optional(),
    sku: commerceProductFields.sku.optional(),
    description: z.string().trim().max(10_000).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    available: z.number().int().nonnegative().optional(),
    reserved: z.number().int().nonnegative().optional(),
    lowStockThreshold: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0)
const createCommerceOrderItemSchema = z
  .object({
    productId: z.uuid().nullable().optional(),
    name: z.string().trim().min(1).max(240),
    sku: z.string().trim().min(1).max(96),
    quantity: z.number().int().positive().max(100_000),
    unitPriceMinor: z.number().int().nonnegative(),
  })
  .strict()
export const createPortalCommerceOrderSchema = z
  .object({
    customerName: z.string().trim().min(1).max(240),
    customerEmail: z.string().trim().email().max(320).nullable().optional(),
    channel: commerceChannelSchema,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    externalReference: z.string().trim().min(1).max(255).optional(),
    orderedAt: z.string().datetime().optional(),
    items: z.array(createCommerceOrderItemSchema).min(1).max(500),
  })
  .strict()
export const updatePortalCommerceOrderSchema = z
  .object({ status: commerceOrderStatusSchema })
  .strict()
export const createPortalCommerceReturnSchema = z
  .object({
    orderId: z.uuid(),
    amountMinor: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict()
export const portalCommerceReturnSchema = z.object({
  id: z.uuid(),
  commerceOrderId: z.uuid(),
  status: z.enum(["requested", "approved", "rejected", "completed"]),
  amountMinor: z.number().int().nonnegative(),
  reason: z.string(),
})

export const portalAffiliateProfileSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  status: z.enum(["active", "suspended"]),
  commissionRateBps: z.number().int().min(0).max(10_000),
  payoutCurrency: z.string().length(3),
  createdAt: z.string().datetime(),
})
export const portalAffiliateDashboardSchema = z.object({
  profile: portalAffiliateProfileSchema.nullable(),
  totals: z.object({
    visits: z.number().int().nonnegative(),
    referrals: z.number().int().nonnegative(),
    conversions: z.number().int().nonnegative(),
    pendingMinor: z.number().int().nonnegative(),
    availableMinor: z.number().int().nonnegative(),
    paidMinor: z.number().int().nonnegative(),
    currency: z.string().length(3),
  }),
  commissions: z.array(
    z.object({
      id: z.uuid(),
      status: z.enum(["pending", "available", "paid", "cancelled"]),
      amountMinor: z.number().int().positive(),
      currency: z.string().length(3),
      createdAt: z.string().datetime(),
    })
  ),
  withdrawals: z.array(
    z.object({
      id: z.uuid(),
      status: z.enum(["requested", "approved", "paid", "rejected"]),
      amountMinor: z.number().int().positive(),
      currency: z.string().length(3),
      createdAt: z.string().datetime(),
    })
  ),
})
export const requestPortalAffiliateWithdrawalSchema = z
  .object({ amountMinor: z.number().int().positive() })
  .strict()
export const captureAffiliateReferralSchema = z
  .object({
    code: z.string().trim().min(3).max(48),
    source: z.string().trim().max(120).optional(),
    landingPath: z.string().trim().max(500).optional(),
  })
  .strict()
export const capturedAffiliateReferralSchema = z.object({
  referralId: z.uuid(),
})

export type PortalCommerceQuery = z.infer<typeof portalCommerceQuerySchema>
export type PortalCommerceDashboard = z.infer<
  typeof portalCommerceDashboardSchema
>
export type PortalCommerceProduct = z.infer<typeof portalCommerceProductSchema>
export type PortalCommerceOrder = z.infer<typeof portalCommerceOrderSchema>
export type CreatePortalCommerceProductInput = z.infer<
  typeof createPortalCommerceProductSchema
>
export type UpdatePortalCommerceProductInput = z.infer<
  typeof updatePortalCommerceProductSchema
>
export type CreatePortalCommerceOrderInput = z.infer<
  typeof createPortalCommerceOrderSchema
>
export type UpdatePortalCommerceOrderInput = z.infer<
  typeof updatePortalCommerceOrderSchema
>
export type CreatePortalCommerceReturnInput = z.infer<
  typeof createPortalCommerceReturnSchema
>
export type PortalCommerceReturn = z.infer<typeof portalCommerceReturnSchema>
export type PortalAffiliateDashboard = z.infer<
  typeof portalAffiliateDashboardSchema
>
export type RequestPortalAffiliateWithdrawalInput = z.infer<
  typeof requestPortalAffiliateWithdrawalSchema
>
export type CaptureAffiliateReferralInput = z.infer<
  typeof captureAffiliateReferralSchema
>
export type CapturedAffiliateReferral = z.infer<
  typeof capturedAffiliateReferralSchema
>
