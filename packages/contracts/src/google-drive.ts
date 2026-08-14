import { z } from "zod"

export const googleDriveIntegrationProviderKey = "google-drive" as const

export const googleDriveIntegrationConfigurationSchema = z
  .object({
    oauthClientId: z.string().trim().min(1).max(512),
    browserApiKey: z.string().trim().min(1).max(512),
    appId: z
      .string()
      .trim()
      .regex(/^\d{6,32}$/),
  })
  .strict()

export const googleDriveIntegrationReadinessSchema = z.enum([
  "ready",
  "incomplete",
  "untested",
  "disabled",
])

export const googleDriveIntegrationSchema = z.object({
  providerKey: z.literal(googleDriveIntegrationProviderKey),
  label: z.literal("Google Drive"),
  description: z.string().min(1).max(500),
  enabled: z.boolean(),
  readiness: googleDriveIntegrationReadinessSchema,
  oauthClientId: z.string().nullable(),
  browserApiKey: z.string().nullable(),
  appId: z.string().nullable(),
  lastTestedAt: z.string().datetime().nullable(),
})

export const googleDrivePickerSelectionSchema = z
  .object({
    providerFileId: z.string().trim().min(1).max(1024),
    resourceKey: z.string().trim().min(1).max(2048).optional(),
  })
  .strict()

export const testGoogleDriveIntegrationSchema = z
  .object({
    configuration: googleDriveIntegrationConfigurationSchema,
    accessToken: z.string().trim().min(1).max(8192),
    selection: googleDrivePickerSelectionSchema,
  })
  .strict()

export const testGoogleDriveIntegrationResponseSchema = z.object({
  testedAt: z.string().datetime(),
})

export const updateGoogleDriveIntegrationSchema = z
  .object({
    enabled: z.boolean(),
    configuration: googleDriveIntegrationConfigurationSchema,
  })
  .strict()

export const portalGoogleDriveConfigurationSchema = z.object({
  enabled: z.boolean(),
  oauthClientId: z.string().nullable(),
  browserApiKey: z.string().nullable(),
  appId: z.string().nullable(),
  configurationFingerprint: z.string().length(64).nullable(),
})

export const googleDriveImportSourceContextSchema = z.enum([
  "files",
  "publishing",
])

export const googleDriveImportBatchStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "partial",
  "failed",
  "expired",
])

export const googleDriveImportItemStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
])

export const createGoogleDriveImportBatchSchema = z
  .object({
    accessToken: z.string().trim().min(1).max(8192),
    credentialExpiresAt: z.string().datetime(),
    destinationFolderId: z.uuid().nullable().optional(),
    idempotencyKey: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:~-]*$/),
    sourceContext: googleDriveImportSourceContextSchema,
    files: z.array(googleDrivePickerSelectionSchema).min(1).max(20),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.sourceContext === "publishing" && input.files.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["files"],
        message:
          "Publishing admite un archivo de Google Drive por importación.",
      })
    }
    if (
      new Set(input.files.map((file) => file.providerFileId)).size !==
      input.files.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["files"],
        message: "No repitas archivos de Google Drive.",
      })
    }
  })

export const googleDriveImportItemSchema = z.object({
  id: z.uuid(),
  status: googleDriveImportItemStatusSchema,
  fileAssetId: z.uuid().nullable(),
  errorCode: z.string().nullable(),
})

export const googleDriveImportBatchSchema = z.object({
  id: z.uuid(),
  sourceContext: googleDriveImportSourceContextSchema,
  destinationFolderId: z.uuid().nullable(),
  status: googleDriveImportBatchStatusSchema,
  totalItems: z.number().int().positive(),
  completedItems: z.number().int().nonnegative(),
  failedItems: z.number().int().nonnegative(),
  items: z.array(googleDriveImportItemSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type GoogleDriveIntegrationConfiguration = z.infer<
  typeof googleDriveIntegrationConfigurationSchema
>
export type GoogleDriveIntegration = z.infer<
  typeof googleDriveIntegrationSchema
>
export type TestGoogleDriveIntegrationInput = z.infer<
  typeof testGoogleDriveIntegrationSchema
>
export type TestGoogleDriveIntegrationResponse = z.infer<
  typeof testGoogleDriveIntegrationResponseSchema
>
export type UpdateGoogleDriveIntegrationInput = z.infer<
  typeof updateGoogleDriveIntegrationSchema
>
export type PortalGoogleDriveConfiguration = z.infer<
  typeof portalGoogleDriveConfigurationSchema
>
export type GoogleDrivePickerSelection = z.infer<
  typeof googleDrivePickerSelectionSchema
>
export type CreateGoogleDriveImportBatchInput = z.infer<
  typeof createGoogleDriveImportBatchSchema
>
export type GoogleDriveImportBatch = z.infer<
  typeof googleDriveImportBatchSchema
>
