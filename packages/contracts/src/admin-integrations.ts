import { z } from "zod"

export const metaIntegrationProviderKey = "facebook" as const

export const metaCapabilityKeySchema = z.enum([
  "facebook_page",
  "instagram_profile",
])

const metaConfigurationSchema = z.object({
  clientId: z.string().trim().min(1).max(4096),
  clientSecret: z.string().trim().min(1).max(4096),
})

const metaConfigurationDraftSchema = z.object({
  clientId: z.string().trim().min(1).max(4096),
  clientSecret: z.string().trim().min(1).max(4096).optional(),
})

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

export type MetaCapabilityKey = z.infer<typeof metaCapabilityKeySchema>
export type MetaIntegration = z.infer<typeof metaIntegrationSchema>
export type TestMetaIntegrationInput = z.infer<typeof testMetaIntegrationSchema>
export type TestMetaIntegrationResponse = z.infer<
  typeof testMetaIntegrationResponseSchema
>
export type UpdateMetaIntegrationInput = z.infer<
  typeof updateMetaIntegrationSchema
>
export type MetaIntegrationConfiguration = z.infer<
  typeof metaConfigurationSchema
>
