import { z } from "zod"

import { supportedLocaleSchema } from "./locale.js"

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

/** Los textos de un correo en un idioma concreto. */
export const adminEmailTemplateCopySchema = z.object({
  locale: supportedLocaleSchema,
  subject: z.string(),
  title: z.string(),
  body: z.string(),
  actionLabel: z.string().nullable(),
  notice: z.string().nullable(),
  /** Falso mientras ese idioma use los textos por defecto del código. */
  customized: z.boolean(),
  updatedAt: z.string().datetime().nullable(),
})

export const adminEmailTemplateSchema = z.object({
  key: emailTemplateKeySchema,
  name: z.string(),
  description: z.string(),
  /** Un juego de textos por idioma soportado, siempre en el mismo orden. */
  copies: z.array(adminEmailTemplateCopySchema).min(1),
  variables: z.array(emailTemplateVariableSchema),
})

export const adminEmailTemplatesResponseSchema = z.object({
  templates: z.array(adminEmailTemplateSchema),
})

export const updateAdminEmailTemplateSchema = z
  .object({
    locale: supportedLocaleSchema,
    subject: z.string().trim().min(1).max(250),
    title: z.string().trim().min(1).max(250),
    body: z.string().trim().min(1).max(2000),
    actionLabel: z.string().trim().max(120).optional(),
    notice: z.string().trim().max(2000).optional(),
  })
  .strict()

export const resetAdminEmailTemplateSchema = z
  .object({ locale: supportedLocaleSchema })
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
