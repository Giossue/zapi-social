import { z } from "zod"

export const adminPlanStatusSchema = z.enum(["active", "inactive"])
export const adminPlanCurrencySchema = z.enum(["USD"])
export const adminPlanBillingTypeSchema = z.enum(["monthly", "yearly"])

const adminPlanValuesSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(96)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    status: adminPlanStatusSchema,
    featured: z.boolean(),
    currency: adminPlanCurrencySchema,
    price: z.number().finite().nonnegative(),
    billingType: adminPlanBillingTypeSchema,
    isFree: z.boolean(),
    isDefaultSignup: z.boolean(),
    trialDays: z.number().int().nonnegative().max(3650),
    position: z.number().int().positive().max(1_000_000),
    description: z.string().trim().max(500),
    permissionIds: z.array(z.string().trim().min(1).max(128)).min(1).max(100),
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.isFree && plan.price !== 0) {
      context.addIssue({
        code: "custom",
        path: ["price"],
        message: "Los planes gratuitos deben tener precio cero.",
      })
    }

    if (plan.isDefaultSignup && (!plan.isFree || plan.status !== "active")) {
      context.addIssue({
        code: "custom",
        path: ["isDefaultSignup"],
        message: "El plan predeterminado debe estar activo y ser gratuito.",
      })
    }
  })

export const createAdminPlanSchema = adminPlanValuesSchema
export const updateAdminPlanSchema = adminPlanValuesSchema

export const adminPlanSchema = adminPlanValuesSchema.extend({
  id: z.uuid(),
  subscriberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const adminPlansQuerySchema = z
  .object({
    q: z.string().trim().max(255).optional(),
    status: adminPlanStatusSchema.optional(),
    billingType: adminPlanBillingTypeSchema.optional(),
    featured: z.enum(["true", "false"]).optional(),
  })
  .strict()

export const adminPlansListSchema = z.object({
  plans: z.array(adminPlanSchema),
})

export type AdminPlan = z.infer<typeof adminPlanSchema>
export type AdminPlanStatus = z.infer<typeof adminPlanStatusSchema>
export type AdminPlanCurrency = z.infer<typeof adminPlanCurrencySchema>
export type AdminPlanBillingType = z.infer<typeof adminPlanBillingTypeSchema>
export type CreateAdminPlanInput = z.infer<typeof createAdminPlanSchema>
export type UpdateAdminPlanInput = z.infer<typeof updateAdminPlanSchema>
export type AdminPlansQuery = z.infer<typeof adminPlansQuerySchema>
export type AdminPlansList = z.infer<typeof adminPlansListSchema>
