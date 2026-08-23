import { z } from "zod"

/** Los nueve tipos que soportaba el addon Laravel. */
export const linkBioBlockTypeSchema = z.enum([
  "links",
  "header",
  "social",
  "contact",
  "gallery",
  "faq",
  "product",
  "video",
  "embed",
])

/** Tipos cuyos ítems se editan en lista. */
export const linkBioItemBlockTypes = [
  "links",
  "social",
  "contact",
  "gallery",
  "faq",
  "product",
] as const

export const linkBioBlockItemSchema = z
  .object({
    label: z.string().trim().max(160).default(""),
    url: z.string().trim().max(2048).default(""),
    note: z.string().trim().max(300).default(""),
    icon: z.string().trim().max(80).default(""),
    image: z.string().trim().max(2048).default(""),
    value: z.string().trim().max(300).default(""),
    price: z.string().trim().max(60).default(""),
    placeholder: z.string().trim().max(160).default(""),
    answer: z.string().trim().max(2000).default(""),
    fieldType: z.enum(["text", "email", "phone", "textarea"]).default("text"),
  })
  .strict()

export const linkBioBlockSchema = z
  .object({
    type: linkBioBlockTypeSchema,
    title: z.string().trim().max(160).default(""),
    subtitle: z.string().trim().max(300).default(""),
    content: z.string().trim().max(5000).default(""),
    url: z.string().trim().max(2048).default(""),
    buttonLabel: z.string().trim().max(80).default(""),
    buttonUrl: z.string().trim().max(2048).default(""),
    enabled: z.boolean().default(true),
    items: z.array(linkBioBlockItemSchema).max(50).default([]),
  })
  .strict()

export const linkBioAppearanceSchema = z
  .object({
    accent: z
      .enum(["primary", "success", "warning", "info", "destructive"])
      .default("primary"),
    avatarStyle: z.enum(["circle", "rounded", "square"]).default("circle"),
    buttonStyle: z.enum(["rounded", "pill", "square"]).default("rounded"),
    contentAlign: z.enum(["left", "center"]).default("center"),
    brandingText: z.string().trim().max(160).default(""),
    backgroundOverlay: z.number().int().min(0).max(85).default(28),
    backgroundPosition: z.enum(["top", "center", "bottom"]).default("center"),
    backgroundFit: z.enum(["cover", "contain", "pattern"]).default("cover"),
  })
  .strict()

export const linkBioTemplateKeySchema = z.enum([
  "aurora",
  "minimal",
  "spotlight",
  "paper",
  "pro-dark",
  "soft",
  "studio",
  "wave",
  "sunset",
  "sky",
  "forest",
  "promo",
])

export const linkBioPageStatusSchema = z.enum(["draft", "published"])

export const portalLinkBioPageSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  headline: z.string(),
  description: z.string(),
  templateKey: linkBioTemplateKeySchema,
  status: linkBioPageStatusSchema,
  blocks: z.array(linkBioBlockSchema),
  appearance: linkBioAppearanceSchema,
  avatarFileAssetId: z.uuid().nullable(),
  coverFileAssetId: z.uuid().nullable(),
  views: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const portalLinkBioPagesResponseSchema = z.object({
  canManage: z.boolean(),
  pages: z.array(portalLinkBioPageSchema),
  metrics: z.object({
    total: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
    views: z.number().int().nonnegative(),
    clicks: z.number().int().nonnegative(),
  }),
})

export const upsertPortalLinkBioPageSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    title: z.string().trim().min(1).max(160),
    headline: z.string().trim().max(190).default(""),
    description: z.string().trim().max(2000).default(""),
    templateKey: linkBioTemplateKeySchema.default("aurora"),
    status: linkBioPageStatusSchema.default("draft"),
    blocks: z.array(linkBioBlockSchema).max(30).default([]),
    appearance: linkBioAppearanceSchema.prefault({}),
    avatarFileAssetId: z.uuid().nullable().default(null),
    coverFileAssetId: z.uuid().nullable().default(null),
  })
  .strict()

/** Página tal como la ve un visitante: sin identificadores internos. */
export const publicLinkBioPageSchema = z.object({
  slug: z.string(),
  title: z.string(),
  headline: z.string(),
  description: z.string(),
  templateKey: linkBioTemplateKeySchema,
  appearance: linkBioAppearanceSchema,
  blocks: z.array(linkBioBlockSchema),
  avatarUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
})

export const trackPublicLinkBioEventSchema = z
  .object({
    type: z.enum(["view", "click"]),
    blockIndex: z.number().int().nonnegative().max(100).optional(),
    itemIndex: z.number().int().nonnegative().max(100).optional(),
  })
  .strict()

export type LinkBioBlockType = z.infer<typeof linkBioBlockTypeSchema>
export type LinkBioBlockItem = z.infer<typeof linkBioBlockItemSchema>
export type LinkBioBlock = z.infer<typeof linkBioBlockSchema>
export type LinkBioAppearance = z.infer<typeof linkBioAppearanceSchema>
export type LinkBioTemplateKey = z.infer<typeof linkBioTemplateKeySchema>
export type PortalLinkBioPage = z.infer<typeof portalLinkBioPageSchema>
export type PortalLinkBioPagesResponse = z.infer<
  typeof portalLinkBioPagesResponseSchema
>
export type UpsertPortalLinkBioPageInput = z.infer<
  typeof upsertPortalLinkBioPageSchema
>
export type PublicLinkBioPage = z.infer<typeof publicLinkBioPageSchema>
export type TrackPublicLinkBioEventInput = z.infer<
  typeof trackPublicLinkBioEventSchema
>
