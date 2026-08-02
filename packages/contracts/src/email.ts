import { z } from "zod"

export const emailSmtpIntegrationProviderKey = "email-smtp" as const

const smtpHostSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(
    /^[^\s/:]+$/,
    "El host SMTP no puede incluir esquema, puerto ni espacios."
  )

export const emailSmtpIntegrationConfigurationSchema = z
  .object({
    host: smtpHostSchema,
    port: z.number().int().min(1).max(65535),
    secure: z.boolean(),
    username: z.string().trim().min(1).max(4096),
    password: z.string().trim().min(1).max(4096),
    fromEmail: z.string().trim().email().max(320),
    fromName: z.string().trim().min(1).max(160),
  })
  .strict()

const emailSmtpIntegrationConfigurationDraftSchema = z
  .object({
    host: smtpHostSchema,
    port: z.number().int().min(1).max(65535),
    secure: z.boolean(),
    username: z.string().trim().min(1).max(4096),
    password: z.string().trim().min(1).max(4096).optional(),
    fromEmail: z.string().trim().email().max(320),
    fromName: z.string().trim().min(1).max(160),
  })
  .strict()

export const emailSmtpIntegrationReadinessSchema = z.enum([
  "ready",
  "incomplete",
  "untested",
  "disabled",
])

export const emailSmtpIntegrationSchema = z.object({
  providerKey: z.literal(emailSmtpIntegrationProviderKey),
  label: z.literal("SMTP"),
  description: z.string().min(1).max(500),
  enabled: z.boolean(),
  readiness: emailSmtpIntegrationReadinessSchema,
  host: smtpHostSchema.nullable(),
  port: z.number().int().nullable(),
  secure: z.boolean().nullable(),
  username: z.string().nullable(),
  passwordConfigured: z.boolean(),
  fromEmail: z.string().email().nullable(),
  fromName: z.string().nullable(),
  lastTestedAt: z.string().datetime().nullable(),
})

export const testEmailSmtpIntegrationSchema = z
  .object({ configuration: emailSmtpIntegrationConfigurationDraftSchema })
  .strict()

export const testEmailSmtpIntegrationResponseSchema = z.object({
  testedAt: z.string().datetime(),
})

export const updateEmailSmtpIntegrationSchema = z
  .object({
    enabled: z.boolean(),
    configuration: emailSmtpIntegrationConfigurationDraftSchema.optional(),
  })
  .strict()

export const passwordResetRequestSchema = z
  .object({ email: z.string().trim().email().max(320) })
  .strict()

export const passwordResetConfirmSchema = z
  .object({
    token: z
      .string()
      .min(32)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(128)
      .regex(/[A-Z]/, "La contraseña debe incluir una mayúscula.")
      .regex(/[a-z]/, "La contraseña debe incluir una minúscula.")
      .regex(/[0-9]/, "La contraseña debe incluir un número.")
      .regex(
        /[^A-Za-z0-9]/,
        "La contraseña debe incluir un carácter especial."
      ),
    passwordConfirmation: z.string().min(1).max(128),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"],
  })

export const passwordResetRequestResponseSchema = z.object({
  accepted: z.literal(true),
})

export type EmailSmtpIntegrationConfiguration = z.infer<
  typeof emailSmtpIntegrationConfigurationSchema
>
export type EmailSmtpIntegration = z.infer<typeof emailSmtpIntegrationSchema>
export type TestEmailSmtpIntegrationResponse = z.infer<
  typeof testEmailSmtpIntegrationResponseSchema
>
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>
export type PasswordResetConfirmInput = z.infer<
  typeof passwordResetConfirmSchema
>
