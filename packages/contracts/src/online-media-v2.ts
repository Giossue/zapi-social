import { z } from "zod"

export const pexelsIntegrationProviderKey = "pexels" as const

export const pexelsIntegrationConfigurationSchema = z
  .object({ apiKey: z.string().trim().min(1).max(4096) })
  .strict()

const pexelsIntegrationConfigurationDraftSchema = z
  .object({ apiKey: z.string().trim().min(1).max(4096).optional() })
  .strict()

export const pexelsIntegrationSchema = z.object({
  providerKey: z.literal(pexelsIntegrationProviderKey),
  label: z.literal("Pexels"),
  enabled: z.boolean(),
  readiness: z.enum(["ready", "incomplete", "untested", "disabled"]),
  apiKeyConfigured: z.boolean(),
  lastTestedAt: z.string().datetime().nullable(),
})

export const testPexelsIntegrationSchema = z
  .object({
    configuration: pexelsIntegrationConfigurationDraftSchema.optional(),
  })
  .strict()

export const testPexelsIntegrationResponseSchema = z.object({
  testedAt: z.string().datetime(),
})

export const updatePexelsIntegrationSchema = z
  .object({
    enabled: z.boolean(),
    configuration: pexelsIntegrationConfigurationDraftSchema.optional(),
  })
  .strict()

export const onlineMediaProviderSchema = z.enum(["auto", "unsplash", "pexels"])
export const onlineMediaTypeSchema = z.enum(["image", "video"])
export const portalOnlineMediaSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200),
    provider: onlineMediaProviderSchema.default("auto"),
    type: onlineMediaTypeSchema.default("image"),
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(50).default(24),
  })
  .strict()
export const portalOnlineMediaResultSchema = z.object({
  id: z.string(),
  provider: z.enum(["unsplash", "pexels"]),
  type: onlineMediaTypeSchema,
  title: z.string(),
  authorName: z.string(),
  authorUrl: z.string().url().nullable(),
  sourceUrl: z.string().url(),
  previewUrl: z.string().url(),
  downloadUrl: z.string().url(),
  mimeType: z.string(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
})
export const portalOnlineMediaSearchResponseSchema = z.object({
  results: z.array(portalOnlineMediaResultSchema),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  configuredProviders: z.array(z.enum(["unsplash", "pexels"])),
})
export const importPortalOnlineMediaSchema = portalOnlineMediaResultSchema
  .pick({
    id: true,
    provider: true,
    type: true,
    title: true,
    authorName: true,
    authorUrl: true,
    sourceUrl: true,
    downloadUrl: true,
    mimeType: true,
  })
  .extend({ folderId: z.uuid().nullable().optional() })
  .strict()
export const importedPortalOnlineMediaSchema = z.object({
  fileAssetId: z.uuid(),
})

export type PortalOnlineMediaSearchQuery = z.infer<
  typeof portalOnlineMediaSearchQuerySchema
>
export type PexelsIntegration = z.infer<typeof pexelsIntegrationSchema>
export type PexelsIntegrationConfiguration = z.infer<
  typeof pexelsIntegrationConfigurationSchema
>
export type TestPexelsIntegrationInput = z.infer<
  typeof testPexelsIntegrationSchema
>
export type TestPexelsIntegrationResponse = z.infer<
  typeof testPexelsIntegrationResponseSchema
>
export type UpdatePexelsIntegrationInput = z.infer<
  typeof updatePexelsIntegrationSchema
>
export type PortalOnlineMediaResult = z.infer<
  typeof portalOnlineMediaResultSchema
>
export type PortalOnlineMediaSearchResponse = z.infer<
  typeof portalOnlineMediaSearchResponseSchema
>
export type ImportPortalOnlineMediaInput = z.infer<
  typeof importPortalOnlineMediaSchema
>
export type ImportedPortalOnlineMedia = z.infer<
  typeof importedPortalOnlineMediaSchema
>
