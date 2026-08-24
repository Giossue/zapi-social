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

export const publicSiteOverviewSchema = z.object({
  settings: publicSiteSettingsSchema,
  languages: z.array(publicSiteLanguageSchema),
  plans: z.array(publicSitePlanSchema),
  creditPackages: z.array(publicSiteCreditPackageSchema),
  faqs: z.array(publicSiteFaqSchema),
  pages: z.array(publicSitePageSummarySchema),
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
export type PublicSiteOverview = z.infer<typeof publicSiteOverviewSchema>
export type PublicSitePostsQuery = z.infer<typeof publicSitePostsQuerySchema>
export type PublicSitePostsResponse = z.infer<
  typeof publicSitePostsResponseSchema
>
