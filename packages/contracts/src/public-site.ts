import { z } from "zod"

export const publicSiteSettingsSchema = z.object({
  siteName: z.string(),
  siteDescription: z.string(),
  companyName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  supportHours: z.string(),
  timezone: z.string(),
  dateFormat: z.string(),
  analytics: z.object({ measurementId: z.string() }).nullable(),
  registrationEnabled: z.boolean(),
})

export const publicSiteLanguageSchema = z.object({
  code: z.string(),
  name: z.string(),
  nativeName: z.string(),
  direction: z.enum(["ltr", "rtl"]),
  isDefault: z.boolean(),
})

export const publicSitePlanSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  currency: z.string(),
  priceMinor: z.number().int().nonnegative(),
  billingType: z.enum(["monthly", "yearly"]),
  isFree: z.boolean(),
  featured: z.boolean(),
  trialDays: z.number().int().nonnegative(),
  position: z.number().int(),
  permissionIds: z.array(z.string()),
})

export const publicSiteCreditPackageSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  units: z.number().int().positive(),
  priceMinor: z.number().int().nonnegative(),
  currency: z.string(),
  featured: z.boolean(),
})

export const publicSiteFaqSchema = z.object({
  id: z.uuid(),
  question: z.string(),
  answer: z.string(),
})

export const publicSitePageSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
})

export const publicSitePageSchema = publicSitePageSummarySchema.extend({
  content: z.string(),
})

export const publicSitePostSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  categoryName: z.string().nullable(),
  publishedAt: z.string().datetime().nullable(),
})

export const publicSitePostSchema = publicSitePostSummarySchema.extend({
  content: z.string(),
  tags: z.array(z.string()),
})

export const publicSiteSectionsSchema = z.object({
  landingEnabled: z.boolean(),
  showPricing: z.boolean(),
  showFaqs: z.boolean(),
  showBlog: z.boolean(),
  showLanguages: z.boolean(),
  showContact: z.boolean(),
  featuredPlansLimit: z.number().int().positive(),
  featuredFaqsLimit: z.number().int().positive(),
  latestPostsLimit: z.number().int().positive(),
})

export const publicSiteStatsSchema = z.object({
  plans: z.number().int().nonnegative(),
  posts: z.number().int().nonnegative(),
  faqs: z.number().int().nonnegative(),
})

export const publicSiteOverviewSchema = z.object({
  settings: publicSiteSettingsSchema,
  sections: publicSiteSectionsSchema,
  stats: publicSiteStatsSchema,
  languages: z.array(publicSiteLanguageSchema),
  plans: z.array(publicSitePlanSchema),
  creditPackages: z.array(publicSiteCreditPackageSchema),
  faqs: z.array(publicSiteFaqSchema),
  latestPosts: z.array(publicSitePostSummarySchema),
  pages: z.array(publicSitePageSummarySchema),
})

export const publicSiteFaqsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
  })
  .strict()

export const publicSiteFaqsResponseSchema = z.object({
  faqs: z.array(publicSiteFaqSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

export const publicSitePostsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    category: z.string().trim().min(1).max(140).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(24).default(9),
  })
  .strict()

export const publicSitePostsResponseSchema = z.object({
  posts: z.array(publicSitePostSummarySchema),
  categories: z.array(z.object({ slug: z.string(), name: z.string() })),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

export type PublicSiteSettings = z.infer<typeof publicSiteSettingsSchema>
export type PublicSiteLanguage = z.infer<typeof publicSiteLanguageSchema>
export type PublicSitePlan = z.infer<typeof publicSitePlanSchema>
export type PublicSiteCreditPackage = z.infer<
  typeof publicSiteCreditPackageSchema
>
export type PublicSiteFaq = z.infer<typeof publicSiteFaqSchema>
export type PublicSitePageSummary = z.infer<typeof publicSitePageSummarySchema>
export type PublicSitePage = z.infer<typeof publicSitePageSchema>
export type PublicSitePostSummary = z.infer<typeof publicSitePostSummarySchema>
export type PublicSitePost = z.infer<typeof publicSitePostSchema>
export type PublicSiteSections = z.infer<typeof publicSiteSectionsSchema>
export type PublicSiteStats = z.infer<typeof publicSiteStatsSchema>
export type PublicSiteOverview = z.infer<typeof publicSiteOverviewSchema>
export type PublicSiteFaqsQuery = z.infer<typeof publicSiteFaqsQuerySchema>
export type PublicSiteFaqsResponse = z.infer<
  typeof publicSiteFaqsResponseSchema
>
export type PublicSitePostsQuery = z.infer<typeof publicSitePostsQuerySchema>
export type PublicSitePostsResponse = z.infer<
  typeof publicSitePostsResponseSchema
>

export const publicBrandingSchema = z.object({
  siteName: z.string(),
  primaryColor: z.string(),
  favicon: z.string(),
  logoLight: z.string(),
  logoDark: z.string(),
  logoBrandLight: z.string(),
  logoBrandDark: z.string(),
})

export type PublicBranding = z.infer<typeof publicBrandingSchema>
