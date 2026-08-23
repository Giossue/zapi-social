/**
 * Fixtures del mock de `AdminBlogs → RSS Feeds` (`blog_rss_sources`). Su
 * contenido representa registros de la base, no texto de interfaz.
 */

export type AdminBlogRssFeed = {
  id: string
  name: string
  feedUrl: string
  categoryId: string | null
  tagIds: string[]
  syncIntervalMinutes: number
  maxItemsPerRun: number
  aiPrompt: string
  isActive: boolean
  autoPublish: boolean
  aiImprove: boolean
  aiAutoTranslate: boolean
  importCount: number
  lastImportedAt: string | null
}

export type AdminBlogRssFeedsResponse = {
  categories: readonly { id: string; name: string }[]
  items: readonly AdminBlogRssFeed[]
  tags: readonly { id: string; name: string }[]
  total: number
}

export const rssCategories = [
  { id: "category-product", name: "Producto" },
  { id: "category-guides", name: "Guías" },
  { id: "category-news", name: "Noticias" },
] as const

export const rssTags = [
  { id: "tag-automation", name: "Automatización" },
  { id: "tag-instagram", name: "Instagram" },
  { id: "tag-marketing", name: "Marketing" },
] as const

export const initialFeeds: readonly AdminBlogRssFeed[] = [
  {
    id: "rss-1",
    name: "Novedades del sector",
    feedUrl: "https://feeds.example.com/social-news.xml",
    categoryId: "category-news",
    tagIds: ["tag-automation"],
    syncIntervalMinutes: 60,
    maxItemsPerRun: 5,
    aiPrompt: "",
    isActive: true,
    autoPublish: true,
    aiImprove: false,
    aiAutoTranslate: false,
    importCount: 18,
    lastImportedAt: "Hoy, 08:40",
  },
  {
    id: "rss-2",
    name: "Blog de producto",
    feedUrl: "https://producto.example.com/rss",
    categoryId: "category-product",
    tagIds: ["tag-instagram", "tag-marketing"],
    syncIntervalMinutes: 240,
    maxItemsPerRun: 3,
    aiPrompt:
      "Reescribe el artículo importado con una introducción más clara y un tono editorial neutro.",
    isActive: true,
    autoPublish: false,
    aiImprove: true,
    aiAutoTranslate: true,
    importCount: 42,
    lastImportedAt: "8 ago 2026",
  },
  {
    id: "rss-3",
    name: "Tendencias de marketing",
    feedUrl: "https://marketing.example.com/feed",
    categoryId: "category-guides",
    tagIds: ["tag-marketing"],
    syncIntervalMinutes: 1440,
    maxItemsPerRun: 10,
    aiPrompt: "",
    isActive: false,
    autoPublish: true,
    aiImprove: false,
    aiAutoTranslate: false,
    importCount: 7,
    lastImportedAt: "28 jul 2026",
  },
]
