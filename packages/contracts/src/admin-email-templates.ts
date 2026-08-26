import { z } from "zod"

export const DEFAULT_EMAIL_TEMPLATE_LOCALE = "*"

export const emailTemplateLocaleSchema = z
  .string()
  .trim()
  .min(1)
  .max(8)
  .regex(/^(\*|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?)$/)

export const emailTemplateKeySchema = z.enum([
  "password_reset",
  "team_invitation",
  "team_invitation_accepted",
  "team_access_updated",
  "team_member_removed",
  "team_ownership_new_owner",
  "team_ownership_previous_owner",
  "board_task_assigned",
  "board_task_due_soon",
])

export const emailTemplateVariableSchema = z.object({
  token: z.string(),
  description: z.string(),
})

export const adminEmailTemplateCopySchema = z.object({
  locale: emailTemplateLocaleSchema,
  subject: z.string(),
  title: z.string(),
  body: z.string(),
  actionLabel: z.string().nullable(),
  notice: z.string().nullable(),
  customized: z.boolean(),
  isActive: z.boolean(),
  updatedAt: z.string().datetime().nullable(),
})

export const adminEmailTemplateSchema = z.object({
  key: emailTemplateKeySchema,
  name: z.string(),
  description: z.string(),
  defaultCopy: adminEmailTemplateCopySchema,
  overrides: z.array(adminEmailTemplateCopySchema),
  variables: z.array(emailTemplateVariableSchema),
})

export const adminEmailTemplatesResponseSchema = z.object({
  templates: z.array(adminEmailTemplateSchema),
})

export const updateAdminEmailTemplateSchema = z
  .object({
    locale: emailTemplateLocaleSchema,
    subject: z.string().trim().min(1).max(250),
    title: z.string().trim().min(1).max(250),
    body: z.string().trim().min(1).max(2000),
    actionLabel: z.string().trim().max(120).optional(),
    notice: z.string().trim().max(2000).optional(),
    isActive: z.boolean().default(true),
  })
  .strict()

export const resetAdminEmailTemplateSchema = z
  .object({ locale: emailTemplateLocaleSchema })
  .strict()

export type EmailTemplateKey = z.infer<typeof emailTemplateKeySchema>
export type AdminEmailTemplateCopy = z.infer<
  typeof adminEmailTemplateCopySchema
>
export type EmailTemplateVariable = z.infer<typeof emailTemplateVariableSchema>
export type AdminEmailTemplate = z.infer<typeof adminEmailTemplateSchema>
export type AdminEmailTemplatesResponse = z.infer<
  typeof adminEmailTemplatesResponseSchema
>
export type UpdateAdminEmailTemplateInput = z.infer<
  typeof updateAdminEmailTemplateSchema
>
export type ResetAdminEmailTemplateInput = z.infer<
  typeof resetAdminEmailTemplateSchema
>
