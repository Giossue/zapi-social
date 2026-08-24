import { z } from "zod"

const slugValue = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const listQuery = {
  q: z.string().trim().min(1).max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}

export const adminContentListQuerySchema = z
  .object({
    ...listQuery,
    status: z.enum(["all", "active", "inactive"]).default("all"),
  })
  .strict()

export const adminTaxonomySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
})
export const upsertAdminTaxonomySchema = z
  .object({
    slug: slugValue.optional(),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).default(""),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict()

export const adminBlogTagSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
})
export const upsertAdminBlogTagSchema = z
  .object({
    slug: slugValue.optional(),
    name: z.string().trim().min(1).max(120),
  })
  .strict()

export const adminBlogPostSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  content: z.string(),
  status: z.enum(["draft", "published"]),
  categoryId: z.uuid().nullable(),
  categoryName: z.string().nullable(),
  tagIds: z.array(z.uuid()),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export const upsertAdminBlogPostSchema = z
  .object({
    slug: z.string().trim().toLowerCase().min(1).max(180).optional(),
    title: z.string().trim().min(1).max(200),
    excerpt: z.string().trim().max(500).default(""),
    content: z.string().trim().max(50000).default(""),
    status: z.enum(["draft", "published"]).default("draft"),
    categoryId: z.uuid().nullable().default(null),
    tagIds: z.array(z.uuid()).max(20).default([]),
  })
  .strict()
export const adminBlogPostsQuerySchema = z
  .object({
    ...listQuery,
    status: z.enum(["all", "draft", "published"]).default("all"),
  })
  .strict()

export const adminFaqSchema = z.object({
  id: z.uuid(),
  question: z.string(),
  answer: z.string(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
})
export const upsertAdminFaqSchema = z
  .object({
    question: z.string().trim().min(1).max(250),
    answer: z.string().trim().min(1).max(10000),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict()

export const adminAiTemplateSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  prompt: z.string(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  categoryId: z.uuid().nullable(),
  categoryName: z.string().nullable(),
  createdAt: z.string().datetime(),
})
export const upsertAdminAiTemplateSchema = z
  .object({
    slug: z.string().trim().toLowerCase().min(1).max(180).optional(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).default(""),
    prompt: z.string().trim().min(1).max(20000),
    categoryId: z.uuid().nullable().default(null),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict()

const pageFields = {
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
}

export const adminTaxonomiesResponseSchema = z.object({
  items: z.array(adminTaxonomySchema),
  ...pageFields,
})
export const adminBlogTagsResponseSchema = z.object({
  items: z.array(adminBlogTagSchema),
  ...pageFields,
})
export const adminBlogPostsResponseSchema = z.object({
  posts: z.array(adminBlogPostSchema),
  categories: z.array(adminTaxonomySchema),
  tags: z.array(adminBlogTagSchema),
  ...pageFields,
})
export const adminFaqsResponseSchema = z.object({
  items: z.array(adminFaqSchema),
  ...pageFields,
})
export const adminAiTemplatesResponseSchema = z.object({
  templates: z.array(adminAiTemplateSchema),
  categories: z.array(adminTaxonomySchema),
  ...pageFields,
})

export type AdminContentListQuery = z.infer<typeof adminContentListQuerySchema>
export type AdminTaxonomy = z.infer<typeof adminTaxonomySchema>
export type UpsertAdminTaxonomyInput = z.infer<typeof upsertAdminTaxonomySchema>
export type AdminBlogTag = z.infer<typeof adminBlogTagSchema>
export type UpsertAdminBlogTagInput = z.infer<typeof upsertAdminBlogTagSchema>
export type AdminBlogPost = z.infer<typeof adminBlogPostSchema>
export type UpsertAdminBlogPostInput = z.infer<typeof upsertAdminBlogPostSchema>
export type AdminBlogPostsQuery = z.infer<typeof adminBlogPostsQuerySchema>
export type AdminFaq = z.infer<typeof adminFaqSchema>
export type UpsertAdminFaqInput = z.infer<typeof upsertAdminFaqSchema>
export type AdminAiTemplate = z.infer<typeof adminAiTemplateSchema>
export type UpsertAdminAiTemplateInput = z.infer<
  typeof upsertAdminAiTemplateSchema
>
export type AdminTaxonomiesResponse = z.infer<
  typeof adminTaxonomiesResponseSchema
>
export type AdminBlogTagsResponse = z.infer<typeof adminBlogTagsResponseSchema>
export type AdminBlogPostsResponse = z.infer<
  typeof adminBlogPostsResponseSchema
>
export type AdminFaqsResponse = z.infer<typeof adminFaqsResponseSchema>
export type AdminAiTemplatesResponse = z.infer<
  typeof adminAiTemplatesResponseSchema
>
