import { z } from "zod"

import { planLimitsSchema } from "./plan-limits.js"

export const portalPlanSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  featured: z.boolean(),
  currency: z.literal("USD"),
  priceMinor: z.number().int().nonnegative(),
  billingType: z.enum(["monthly", "yearly"]),
  isFree: z.boolean(),
  isDefaultSignup: z.boolean(),
  trialDays: z.number().int().nonnegative(),
  position: z.number().int().positive(),
  limits: planLimitsSchema,
})

export const portalBillingSubscriptionSchema = z.object({
  status: z.enum([
    "incomplete",
    "trialing",
    "active",
    "past_due",
    "paused",
    "canceled",
    "unpaid",
  ]),
  interval: z.enum(["month", "year"]),
  cancelAtPeriodEnd: z.boolean(),
  currentPeriodEndsAt: z.string().datetime().nullable(),
})

export const portalPlansResponseSchema = z.object({
  plans: z.array(portalPlanSchema),
  currentPlanId: z.uuid().nullable(),
  currentPlanSource: z
    .enum(["signup", "admin", "subscription", "fallback"])
    .nullable(),
  subscription: portalBillingSubscriptionSchema.nullable(),
  checkoutAvailable: z.boolean(),
  canManageBilling: z.boolean(),
})

export const createPortalPlanCheckoutSchema = z
  .object({ planId: z.uuid() })
  .strict()

export const portalPlanCheckoutResponseSchema = z.object({
  checkoutUrl: z.string().url(),
})

export type PortalPlan = z.infer<typeof portalPlanSchema>
export type PortalBillingSubscription = z.infer<
  typeof portalBillingSubscriptionSchema
>
export type PortalPlansResponse = z.infer<typeof portalPlansResponseSchema>
export type CreatePortalPlanCheckoutInput = z.infer<
  typeof createPortalPlanCheckoutSchema
>
export type PortalPlanCheckoutResponse = z.infer<
  typeof portalPlanCheckoutResponseSchema
>
