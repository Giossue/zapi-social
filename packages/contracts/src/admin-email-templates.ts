import { z } from "zod"

export const emailTemplateKeySchema = z.enum([
  "password_reset",
  "team_invitation",
  "team_invitation_accepted",
  "team_access_updated",
  "team_member_removed",
  "team_ownership_new_owner",
  "team_ownership_previous_owner",
])

export const emailTemplateVariableSchema = z.object({
  token: z.string(),
  description: z.string(),
})

export const adminEmailTemplateSchema = z.object({
  key: emailTemplateKeySchema,
  name: z.string(),
  description: z.string(),
  subject: z.string(),
  title: z.string(),
  body: z.string(),
  actionLabel: z.string().nullable(),
  notice: z.string().nullable(),
  /** Falso mientras el correo use los textos por defecto del código. */
  customized: z.boolean(),
  variables: z.array(emailTemplateVariableSchema),
  updatedAt: z.string().datetime().nullable(),
})

export const adminEmailTemplatesResponseSchema = z.object({
  templates: z.array(adminEmailTemplateSchema),
})

export const updateAdminEmailTemplateSchema = z
  .object({
    subject: z.string().trim().min(1).max(250),
    title: z.string().trim().min(1).max(250),
    body: z.string().trim().min(1).max(2000),
    actionLabel: z.string().trim().max(120).optional(),
    notice: z.string().trim().max(2000).optional(),
  })
  .strict()

export type EmailTemplateKey = z.infer<typeof emailTemplateKeySchema>
export type EmailTemplateVariable = z.infer<typeof emailTemplateVariableSchema>
export type AdminEmailTemplate = z.infer<typeof adminEmailTemplateSchema>
export type AdminEmailTemplatesResponse = z.infer<
  typeof adminEmailTemplatesResponseSchema
>
export type UpdateAdminEmailTemplateInput = z.infer<
  typeof updateAdminEmailTemplateSchema
>
