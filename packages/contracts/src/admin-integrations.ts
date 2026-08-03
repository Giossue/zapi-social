import { z } from "zod"

export const metaIntegrationProviderKey = "facebook" as const

export const metaCapabilityKeySchema = z.enum([
  "facebook_page",
  "instagram_profile",
])

export const metaOAuthScopeSchema = z.enum([
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
])

export type MetaCapabilityKey = z.infer<typeof metaCapabilityKeySchema>
export type MetaOAuthScope = z.infer<typeof metaOAuthScopeSchema>

const requiredMetaCapabilityScopes: Record<
  MetaCapabilityKey,
  readonly MetaOAuthScope[]
> = {
  facebook_page: [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
  ],
  instagram_profile: [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
  ],
}

export const metaCapabilityScopeDefaults: Record<
  MetaCapabilityKey,
  MetaOAuthScope[]
> = {
  facebook_page: [
    ...requiredMetaCapabilityScopes.facebook_page,
    "business_management",
  ],
  instagram_profile: [
    ...requiredMetaCapabilityScopes.instagram_profile,
    "business_management",
  ],
}

function capabilityScopesSchema(capabilityKey: MetaCapabilityKey) {
  const requiredScopes = requiredMetaCapabilityScopes[capabilityKey]
  const allowedScopes = new Set<MetaOAuthScope>([
    ...requiredScopes,
    "business_management",
  ])
  return z
    .array(metaOAuthScopeSchema)
    .min(requiredScopes.length)
    .max(metaOAuthScopeSchema.options.length)
    .superRefine((scopes, context) => {
      const seen = new Set<MetaOAuthScope>()
      for (const [index, scope] of scopes.entries()) {
        if (seen.has(scope)) {
          context.addIssue({
            code: "custom",
            path: [index],
            message: "OAuth scopes must not contain duplicates.",
          })
        }
        if (!allowedScopes.has(scope)) {
          context.addIssue({
            code: "custom",
            path: [index],
            message: `OAuth scope is not allowed for ${capabilityKey}: ${scope}.`,
          })
        }
        seen.add(scope)
      }

      for (const requiredScope of requiredScopes) {
        if (!seen.has(requiredScope)) {
          context.addIssue({
            code: "custom",
            message: `Missing required OAuth scope: ${requiredScope}.`,
          })
        }
      }
    })
}

export const metaCapabilityScopesSchema = z
  .object({
    facebook_page: capabilityScopesSchema("facebook_page"),
    instagram_profile: capabilityScopesSchema("instagram_profile"),
  })
  .strict()

export const metaIntegrationConfigurationSchema = z
  .object({
    clientId: z.string().trim().min(1).max(4096),
    clientSecret: z.string().trim().min(1).max(4096),
    capabilityScopes: metaCapabilityScopesSchema.default(
      metaCapabilityScopeDefaults
    ),
  })
  .strict()

const metaConfigurationDraftSchema = z
  .object({
    clientId: z.string().trim().min(1).max(4096),
    clientSecret: z.string().trim().min(1).max(4096).optional(),
    capabilityScopes: metaCapabilityScopesSchema.optional(),
  })
  .strict()

export const metaIntegrationReadinessSchema = z.enum([
  "ready",
  "incomplete",
  "untested",
  "disabled",
])

export const metaIntegrationCapabilitySchema = z.object({
  key: metaCapabilityKeySchema,
  label: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  enabled: z.boolean(),
  callbackUrl: z.url().max(2048),
})

export const metaIntegrationSchema = z.object({
  providerKey: z.literal(metaIntegrationProviderKey),
  label: z.literal("Meta"),
  description: z.string().min(1).max(500),
  enabled: z.boolean(),
  readiness: metaIntegrationReadinessSchema,
  capabilities: z.array(metaIntegrationCapabilitySchema).length(2),
  capabilityScopes: metaCapabilityScopesSchema,
  clientId: z.string().nullable(),
  secretConfigured: z.boolean(),
  lastTestedAt: z.string().datetime().nullable(),
})

export const testMetaIntegrationSchema = z
  .object({ configuration: metaConfigurationDraftSchema })
  .strict()

export const testMetaIntegrationResponseSchema = z.object({
  testedAt: z.string().datetime(),
})

export const updateMetaIntegrationSchema = z
  .object({
    enabled: z.boolean(),
    enabledCapabilityKeys: z.array(metaCapabilityKeySchema).max(2),
    configuration: metaConfigurationDraftSchema.optional(),
  })
  .strict()

export type MetaCapabilityScopes = z.infer<typeof metaCapabilityScopesSchema>
export type MetaIntegration = z.infer<typeof metaIntegrationSchema>
export type TestMetaIntegrationInput = z.infer<typeof testMetaIntegrationSchema>
export type TestMetaIntegrationResponse = z.infer<
  typeof testMetaIntegrationResponseSchema
>
export type UpdateMetaIntegrationInput = z.infer<
  typeof updateMetaIntegrationSchema
>
export type MetaIntegrationConfiguration = z.infer<
  typeof metaIntegrationConfigurationSchema
>

export const whatsappStatusIntegrationProviderKey = "whatsapp-status" as const

const whatsappStatusBaseUrlSchema = z
  .url()
  .max(2048)
  .superRefine((value, context) => {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        message: "La URL de GOWA debe usar HTTP o HTTPS.",
      })
    }
    if (url.username || url.password || url.search || url.hash) {
      context.addIssue({
        code: "custom",
        message:
          "La URL de GOWA no puede incluir credenciales, parámetros ni fragmentos.",
      })
    }
  })

export const whatsappStatusCapabilityKeySchema = z.literal("whatsapp_status")

export const whatsappStatusIntegrationConfigurationSchema = z
  .object({
    baseUrl: whatsappStatusBaseUrlSchema,
    basicAuthUsername: z.string().trim().min(1).max(4096),
    basicAuthPassword: z.string().trim().min(1).max(4096),
  })
  .strict()

const whatsappStatusConfigurationDraftSchema = z
  .object({
    baseUrl: whatsappStatusBaseUrlSchema,
    basicAuthUsername: z.string().trim().min(1).max(4096),
    basicAuthPassword: z.string().trim().min(1).max(4096).optional(),
  })
  .strict()

export const whatsappStatusIntegrationCapabilitySchema = z.object({
  key: whatsappStatusCapabilityKeySchema,
  label: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  enabled: z.boolean(),
})

export const whatsappStatusIntegrationSchema = z.object({
  providerKey: z.literal(whatsappStatusIntegrationProviderKey),
  label: z.literal("WhatsApp Status"),
  description: z.string().min(1).max(500),
  enabled: z.boolean(),
  readiness: metaIntegrationReadinessSchema,
  capabilities: z.array(whatsappStatusIntegrationCapabilitySchema).length(1),
  baseUrl: whatsappStatusBaseUrlSchema.nullable(),
  basicAuthUsername: z.string().nullable(),
  basicAuthPasswordConfigured: z.boolean(),
  lastTestedAt: z.string().datetime().nullable(),
})

export const testWhatsAppStatusIntegrationSchema = z
  .object({ configuration: whatsappStatusConfigurationDraftSchema })
  .strict()

export const testWhatsAppStatusIntegrationResponseSchema = z.object({
  testedAt: z.string().datetime(),
})

export const updateWhatsAppStatusIntegrationSchema = z
  .object({
    enabled: z.boolean(),
    configuration: whatsappStatusConfigurationDraftSchema.optional(),
  })
  .strict()

export type WhatsAppStatusIntegration = z.infer<
  typeof whatsappStatusIntegrationSchema
>
export type WhatsAppStatusIntegrationConfiguration = z.infer<
  typeof whatsappStatusIntegrationConfigurationSchema
>
export type TestWhatsAppStatusIntegrationInput = z.infer<
  typeof testWhatsAppStatusIntegrationSchema
>
export type TestWhatsAppStatusIntegrationResponse = z.infer<
  typeof testWhatsAppStatusIntegrationResponseSchema
>
export type UpdateWhatsAppStatusIntegrationInput = z.infer<
  typeof updateWhatsAppStatusIntegrationSchema
>
