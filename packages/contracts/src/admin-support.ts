import { z } from "zod"

export const adminSupportTicketStatusSchema = z.enum([
  "open",
  "resolved",
  "closed",
])

export const adminSupportTicketsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    status: z.enum(["all", "open", "resolved", "closed"]).default("all"),
    categoryId: z.uuid().optional(),
    awaitingReply: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .transform((value) => value === true || value === "true")
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

export const adminSupportCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  status: z.enum(["active", "inactive"]),
})

export const adminSupportTicketSchema = z.object({
  id: z.uuid(),
  subject: z.string(),
  status: adminSupportTicketStatusSchema,
  category: adminSupportCategorySchema,
  workspace: z.object({ id: z.uuid(), name: z.string() }),
  requester: z.object({
    id: z.uuid(),
    displayName: z.string(),
    email: z.string(),
  }),
  commentCount: z.number().int().nonnegative(),
  awaitingReply: z.boolean(),
  lastActivityAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export const adminSupportTicketCommentSchema = z.object({
  id: z.uuid(),
  authorName: z.string(),
  authorRole: z.enum(["requester", "support"]),
  body: z.string(),
  createdAt: z.string().datetime(),
})

export const adminSupportTicketDetailSchema = adminSupportTicketSchema.extend({
  description: z.string(),
  comments: z.array(adminSupportTicketCommentSchema),
})

export const adminSupportMetricsSchema = z.object({
  open: z.number().int().nonnegative(),
  awaitingReply: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
  closed: z.number().int().nonnegative(),
})

export const adminSupportTicketsResponseSchema = z.object({
  tickets: z.array(adminSupportTicketSchema),
  categories: z.array(adminSupportCategorySchema),
  metrics: adminSupportMetricsSchema,
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

export const createAdminSupportReplySchema = z
  .object({ body: z.string().trim().min(1).max(5000) })
  .strict()

export const updateAdminSupportTicketStatusSchema = z
  .object({ status: adminSupportTicketStatusSchema })
  .strict()

export type AdminSupportTicketStatus = z.infer<
  typeof adminSupportTicketStatusSchema
>
export type AdminSupportTicketsQuery = z.infer<
  typeof adminSupportTicketsQuerySchema
>
export type AdminSupportCategory = z.infer<typeof adminSupportCategorySchema>
export type AdminSupportTicket = z.infer<typeof adminSupportTicketSchema>
export type AdminSupportTicketComment = z.infer<
  typeof adminSupportTicketCommentSchema
>
export type AdminSupportTicketDetail = z.infer<
  typeof adminSupportTicketDetailSchema
>
export type AdminSupportMetrics = z.infer<typeof adminSupportMetricsSchema>
export type AdminSupportTicketsResponse = z.infer<
  typeof adminSupportTicketsResponseSchema
>
export type CreateAdminSupportReplyInput = z.infer<
  typeof createAdminSupportReplySchema
>
export type UpdateAdminSupportTicketStatusInput = z.infer<
  typeof updateAdminSupportTicketStatusSchema
>
