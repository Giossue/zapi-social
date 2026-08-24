import { z } from "zod"

export const localeCodeSchema = z
  .string()
  .min(2)
  .max(12)
  .regex(/^[a-z]{2,3}(-[a-zA-Z0-9]{2,8})?$/)

export type LocaleCode = z.infer<typeof localeCodeSchema>

export const languageDirectionSchema = z.enum(["ltr", "rtl"])

export type LanguageDirection = z.infer<typeof languageDirectionSchema>

export const baseLanguageCodes = ["es", "en"] as const

export const defaultLanguageCode = "es"

export const rtlLanguageCodes = [
  "ar",
  "dv",
  "fa",
  "he",
  "ks",
  "ku",
  "ps",
  "sd",
  "ug",
  "ur",
  "yi",
] as const

export const worldLanguageCodes = [
  "af",
  "am",
  "ar",
  "az",
  "be",
  "bg",
  "bn",
  "bs",
  "ca",
  "ceb",
  "cs",
  "cy",
  "da",
  "de",
  "dv",
  "el",
  "en",
  "eo",
  "es",
  "et",
  "eu",
  "fa",
  "fi",
  "fil",
  "fr",
  "fy",
  "ga",
  "gd",
  "gl",
  "gu",
  "ha",
  "haw",
  "he",
  "hi",
  "hmn",
  "hr",
  "ht",
  "hu",
  "hy",
  "id",
  "ig",
  "is",
  "it",
  "ja",
  "jv",
  "ka",
  "kk",
  "km",
  "kn",
  "ko",
  "ks",
  "ku",
  "ky",
  "la",
  "lb",
  "lo",
  "lt",
  "lv",
  "mg",
  "mi",
  "mk",
  "ml",
  "mn",
  "mr",
  "ms",
  "mt",
  "my",
  "ne",
  "nl",
  "no",
  "ny",
  "or",
  "pa",
  "pl",
  "ps",
  "pt",
  "ro",
  "ru",
  "rw",
  "sd",
  "si",
  "sk",
  "sl",
  "sm",
  "sn",
  "so",
  "sq",
  "sr",
  "st",
  "su",
  "sv",
  "sw",
  "ta",
  "te",
  "tg",
  "th",
  "tk",
  "tr",
  "tt",
  "ug",
  "uk",
  "ur",
  "uz",
  "vi",
  "xh",
  "yi",
  "yo",
  "zh",
  "zu",
] as const

export const publicLanguageSchema = z.object({
  code: localeCodeSchema,
  name: z.string(),
  nativeName: z.string(),
  direction: languageDirectionSchema,
  isDefault: z.boolean(),
})

export const publicLanguagesResponseSchema = z.object({
  languages: z.array(publicLanguageSchema),
})

export const publicLanguageMessagesResponseSchema = z.object({
  code: localeCodeSchema,
  messages: z.record(z.string(), z.string()),
})

export const adminPlatformLanguageSchema = publicLanguageSchema.extend({
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  isBase: z.boolean(),
  translated: z.number().int(),
  total: z.number().int(),
})

export const adminPlatformLanguageCatalogEntrySchema = z.object({
  code: localeCodeSchema,
  name: z.string(),
  nativeName: z.string(),
  direction: languageDirectionSchema,
})

export const adminPlatformLanguagesResponseSchema = z.object({
  languages: z.array(adminPlatformLanguageSchema),
  catalog: z.array(adminPlatformLanguageCatalogEntrySchema),
})

export const createAdminPlatformLanguageSchema = z
  .object({ code: localeCodeSchema })
  .strict()

export const updateAdminPlatformLanguageSchema = z
  .object({
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()

export const adminTranslationRowSchema = z.object({
  key: z.string(),
  source: z.string(),
  value: z.string().nullable(),
})

export const listAdminTranslationsQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    missing: z.coerce.boolean().default(false),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()

export const adminTranslationsResponseSchema = z.object({
  language: adminPlatformLanguageSchema,
  rows: z.array(adminTranslationRowSchema),
  total: z.number().int(),
  filtered: z.number().int(),
})

export const saveAdminTranslationSchema = z
  .object({
    key: z.string().min(1).max(512),
    /** Vacío borra el override: la clave vuelve al texto base. */
    value: z.string().max(4000),
  })
  .strict()

export const importAdminTranslationsSchema = z
  .object({
    messages: z.record(z.string().max(512), z.string().max(4000)),
  })
  .strict()

export const importAdminTranslationsResultSchema = z.object({
  imported: z.number().int(),
  rejected: z.array(z.string()),
  response: adminTranslationsResponseSchema.omit({ rows: true }).optional(),
})

export const exportAdminTranslationsResponseSchema = z.object({
  code: localeCodeSchema,
  messages: z.record(z.string(), z.string()),
})

export type PublicLanguage = z.infer<typeof publicLanguageSchema>
export type PublicLanguagesResponse = z.infer<
  typeof publicLanguagesResponseSchema
>
export type PublicLanguageMessagesResponse = z.infer<
  typeof publicLanguageMessagesResponseSchema
>
export type AdminPlatformLanguage = z.infer<typeof adminPlatformLanguageSchema>
export type AdminPlatformLanguageCatalogEntry = z.infer<
  typeof adminPlatformLanguageCatalogEntrySchema
>
export type AdminPlatformLanguagesResponse = z.infer<
  typeof adminPlatformLanguagesResponseSchema
>
export type CreateAdminPlatformLanguageInput = z.infer<
  typeof createAdminPlatformLanguageSchema
>
export type UpdateAdminPlatformLanguageInput = z.infer<
  typeof updateAdminPlatformLanguageSchema
>
export type AdminTranslationRow = z.infer<typeof adminTranslationRowSchema>
export type ListAdminTranslationsQuery = z.infer<
  typeof listAdminTranslationsQuerySchema
>
export type AdminTranslationsResponse = z.infer<
  typeof adminTranslationsResponseSchema
>
export type SaveAdminTranslationInput = z.infer<
  typeof saveAdminTranslationSchema
>
export type ImportAdminTranslationsInput = z.infer<
  typeof importAdminTranslationsSchema
>
export type ImportAdminTranslationsResult = z.infer<
  typeof importAdminTranslationsResultSchema
>
export type ExportAdminTranslationsResponse = z.infer<
  typeof exportAdminTranslationsResponseSchema
>
