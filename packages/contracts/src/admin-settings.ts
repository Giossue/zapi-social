import { z } from "zod"

export const adminGeneralSettingsSchema = z.object({
  siteName: z.string().trim().max(160).default(""),
  siteDescription: z.string().trim().max(500).default(""),
  contactEmail: z.string().trim().max(320).default(""),
  contactPhone: z.string().trim().max(60).default(""),
  companyName: z.string().trim().max(160).default(""),
  supportHours: z.string().trim().max(160).default(""),
  dateFormat: z.string().trim().max(40).default("d MMM yyyy"),
  timezone: z.string().trim().max(64).default("America/Guayaquil"),
})

export const adminAuthSettingsSchema = z.object({
  registrationEnabled: z.boolean().default(true),
  requireEmailVerification: z.boolean().default(true),
  passwordMinLength: z.number().int().min(8).max(128).default(12),
  sessionLifetimeHours: z.number().int().min(1).max(8760).default(720),
  maxLoginAttempts: z.number().int().min(3).max(50).default(10),
})

export const adminAnalyticsSettingsSchema = z.object({
  googleAnalyticsEnabled: z.boolean().default(false),
  googleAnalyticsMeasurementId: z.string().trim().max(40).default(""),
  trackGuests: z.boolean().default(true),
  trackPortal: z.boolean().default(false),
})

export const adminStaticPageSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().max(50000).default(""),
  isPublished: z.boolean().default(false),
})
export const adminStaticPagesSettingsSchema = z.object({
  pages: z
    .array(adminStaticPageSchema)
    .max(40)
    .default([])
    .refine(
      (pages) => new Set(pages.map((page) => page.slug)).size === pages.length,
      { message: "Cada página necesita una dirección distinta." }
    ),
})

export const adminPublicSiteSettingsSchema = z.object({
  landingEnabled: z.boolean().default(true),
  docsUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === "" || /^https?:\/\//i.test(value), {
      message: "La dirección debe empezar por http:// o https://",
    })
    .default(""),
  showPricing: z.boolean().default(true),
  showFaqs: z.boolean().default(true),
  showBlog: z.boolean().default(true),
  showLanguages: z.boolean().default(true),
  showContact: z.boolean().default(true),
  featuredPlansLimit: z.number().int().min(1).max(12).default(3),
  featuredFaqsLimit: z.number().int().min(1).max(24).default(6),
  latestPostsLimit: z.number().int().min(1).max(12).default(3),
})

export const brandingAssetSchema = z.enum([
  "favicon",
  "logoLight",
  "logoDark",
  "logoBrandLight",
  "logoBrandDark",
])

const brandingAssetValue = z.string().trim().max(2048).default("")

export const brandColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .or(z.literal(""))
  .default("")

export const adminBrandingSettingsSchema = z.object({
  primaryColor: brandColorSchema,
  favicon: brandingAssetValue,
  logoLight: brandingAssetValue,
  logoDark: brandingAssetValue,
  logoBrandLight: brandingAssetValue,
  logoBrandDark: brandingAssetValue,
})

export const adminSettingsGroupSchema = z.enum([
  "general",
  "auth",
  "analytics",
  "static-pages",
  "public-site",
  "branding",
])

export const adminCacheStateSchema = z.object({
  reachable: z.boolean(),
  keys: z.number().int().nonnegative(),
  memoryUsed: z.string(),
  lastPurgedAt: z.string().datetime().nullable(),
})

export const adminScheduledQueueSchema = z.enum([
  "rss-schedule-dispatch",
  "ai-schedule-dispatch",
  "automation-webhooks",
  "meta-profile-schedule",
  "whatsapp-profile-schedule",
  "file-imports",
  "file-derivatives",
])

export const adminScheduledJobSchema = z.object({
  queue: adminScheduledQueueSchema,
  everyMinutes: z.number().int().positive().nullable(),
  nextRunAt: z.string().datetime().nullable(),
  waiting: z.number().int().nonnegative(),
  delayed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
})
export const adminScheduledJobsSchema = z.object({
  reachable: z.boolean(),
  jobs: z.array(adminScheduledJobSchema),
})

export type AdminScheduledQueue = z.infer<typeof adminScheduledQueueSchema>
export type AdminGeneralSettings = z.infer<typeof adminGeneralSettingsSchema>
export type AdminAuthSettings = z.infer<typeof adminAuthSettingsSchema>
export type AdminAnalyticsSettings = z.infer<
  typeof adminAnalyticsSettingsSchema
>
export type AdminStaticPage = z.infer<typeof adminStaticPageSchema>
export type AdminStaticPagesSettings = z.infer<
  typeof adminStaticPagesSettingsSchema
>
export type AdminPublicSiteSettings = z.infer<
  typeof adminPublicSiteSettingsSchema
>
export type BrandingAsset = z.infer<typeof brandingAssetSchema>
export type AdminBrandingSettings = z.infer<typeof adminBrandingSettingsSchema>
export type AdminSettingsGroup = z.infer<typeof adminSettingsGroupSchema>
export type AdminCacheState = z.infer<typeof adminCacheStateSchema>
export type AdminScheduledJob = z.infer<typeof adminScheduledJobSchema>
export type AdminScheduledJobs = z.infer<typeof adminScheduledJobsSchema>
