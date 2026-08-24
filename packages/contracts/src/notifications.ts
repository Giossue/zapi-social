import { z } from "zod"

export const announcementAudienceSchema = z.enum(["all", "workspace", "user"])
export const announcementStatusSchema = z.enum(["draft", "published"])

export const adminAnnouncementSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  url: z.string().nullable(),
  audience: announcementAudienceSchema,
  targetLabel: z.string().nullable(),
  targetWorkspaceId: z.uuid().nullable(),
  targetUserId: z.uuid().nullable(),
  status: announcementStatusSchema,
  publishedAt: z.string().datetime().nullable(),
  createdByName: z.string().nullable(),
  readCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
})

export const adminAnnouncementsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    status: z.enum(["all", "draft", "published"]).default("all"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

export const adminAnnouncementMetricsSchema = z.object({
  published: z.number().int().nonnegative(),
  drafts: z.number().int().nonnegative(),
  targeted: z.number().int().nonnegative(),
  reads: z.number().int().nonnegative(),
})

export const adminAnnouncementsResponseSchema = z.object({
  announcements: z.array(adminAnnouncementSchema),
  metrics: adminAnnouncementMetricsSchema,
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

export const upsertAdminAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
    url: z.union([z.url().max(2048), z.literal("")]).optional(),
    audience: announcementAudienceSchema.default("all"),
    targetWorkspaceId: z.uuid().nullable().optional(),
    targetUserId: z.uuid().nullable().optional(),
    publish: z.boolean().default(false),
  })
  .strict()
  .superRefine((values, context) => {
    if (values.audience === "workspace" && !values.targetWorkspaceId) {
      context.addIssue({
        code: "custom",
        path: ["targetWorkspaceId"],
        message: "Selecciona el espacio de trabajo destinatario.",
      })
    }
    if (values.audience === "user" && !values.targetUserId) {
      context.addIssue({
        code: "custom",
        path: ["targetUserId"],
        message: "Selecciona la persona destinataria.",
      })
    }
  })

export const adminAnnouncementTargetsQuerySchema = z
  .object({ q: z.string().trim().min(1).max(255).optional() })
  .strict()

export const adminAnnouncementTargetsSchema = z.object({
  workspaces: z.array(z.object({ id: z.uuid(), label: z.string() })),
  users: z.array(z.object({ id: z.uuid(), label: z.string() })),
})

export const portalAnnouncementNotificationSchema = z.object({
  source: z.literal("announcement"),
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  url: z.string().nullable(),
  publishedAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
})

export const workspaceNotificationKindSchema = z.enum([
  "board.task_assigned",
  "board.task_commented",
  "board.task_due_soon",
])

export const portalWorkspaceNotificationSchema = z.object({
  source: z.literal("workspace"),
  id: z.uuid(),
  kind: workspaceNotificationKindSchema,
  payload: z.record(z.string(), z.string()),
  url: z.string().nullable(),
  publishedAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
})

export const portalNotificationSchema = z.discriminatedUnion("source", [
  portalAnnouncementNotificationSchema,
  portalWorkspaceNotificationSchema,
])

export const portalNotificationsResponseSchema = z.object({
  notifications: z.array(portalNotificationSchema),
  unread: z.number().int().nonnegative(),
})

export type AnnouncementAudience = z.infer<typeof announcementAudienceSchema>
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>
export type AdminAnnouncement = z.infer<typeof adminAnnouncementSchema>
export type AdminAnnouncementsQuery = z.infer<
  typeof adminAnnouncementsQuerySchema
>
export type AdminAnnouncementMetrics = z.infer<
  typeof adminAnnouncementMetricsSchema
>
export type AdminAnnouncementsResponse = z.infer<
  typeof adminAnnouncementsResponseSchema
>
export type UpsertAdminAnnouncementInput = z.infer<
  typeof upsertAdminAnnouncementSchema
>
export type AdminAnnouncementTargets = z.infer<
  typeof adminAnnouncementTargetsSchema
>
export type WorkspaceNotificationKind = z.infer<
  typeof workspaceNotificationKindSchema
>
export type PortalAnnouncementNotification = z.infer<
  typeof portalAnnouncementNotificationSchema
>
export type PortalWorkspaceNotification = z.infer<
  typeof portalWorkspaceNotificationSchema
>
export type PortalNotification = z.infer<typeof portalNotificationSchema>
export type PortalNotificationsResponse = z.infer<
  typeof portalNotificationsResponseSchema
>
