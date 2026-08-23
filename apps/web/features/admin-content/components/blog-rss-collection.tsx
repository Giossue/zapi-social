"use client"

import { useLocale, useTranslations } from "next-intl"

import { Badge } from "@workspace/ui/components/badge"

import {
  AdminCollectionPage,
  type AdminCollectionConfig,
  type CollectionValues,
} from "./admin-collection-page"

/**
 * Mock visual del módulo Laravel `AdminBlogs → RSS Feeds` (`blog_rss_sources`).
 * Trabaja sobre fixtures locales deterministas: el contrato REST y su backend
 * llegan con la vertical de contenido, sin tocar los endpoints actuales.
 */

type AdminBlogRssFeed = {
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

type AdminBlogRssFeedsResponse = {
  categories: readonly { id: string; name: string }[]
  items: readonly AdminBlogRssFeed[]
  tags: readonly { id: string; name: string }[]
  total: number
}

const rssCategories = [
  { id: "category-product", name: "Producto" },
  { id: "category-guides", name: "Guías" },
  { id: "category-news", name: "Noticias" },
] as const

const rssTags = [
  { id: "tag-automation", name: "Automatización" },
  { id: "tag-instagram", name: "Instagram" },
  { id: "tag-marketing", name: "Marketing" },
] as const

const initialFeeds: readonly AdminBlogRssFeed[] = [
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

/** Estado local del mock; se restablece al recargar la aplicación. */
let feedsStore: AdminBlogRssFeed[] = initialFeeds.map((feed) => ({ ...feed }))
let feedSequence = initialFeeds.length

function categoryName(categoryId: string | null) {
  return (
    rssCategories.find((category) => category.id === categoryId)?.name ?? null
  )
}

function cell(title: string, detail?: string | null) {
  return (
    <div className="flex min-w-40 flex-col">
      <span className="font-medium">{title}</span>
      {detail ? (
        <span className="text-sm text-muted-foreground">{detail}</span>
      ) : null}
    </div>
  )
}

function feedInput(values: CollectionValues) {
  const categoryId = String(values.categoryId ?? "none")
  return {
    aiAutoTranslate: Boolean(values.aiAutoTranslate),
    aiImprove: Boolean(values.aiImprove),
    aiPrompt: String(values.aiPrompt ?? ""),
    autoPublish: Boolean(values.autoPublish),
    categoryId: categoryId === "none" ? null : categoryId,
    feedUrl: String(values.feedUrl ?? ""),
    isActive: Boolean(values.isActive),
    maxItemsPerRun: Number(values.maxItemsPerRun ?? 0) || 5,
    name: String(values.name ?? ""),
    syncIntervalMinutes: Number(values.syncIntervalMinutes ?? 0) || 60,
    tagIds: Array.isArray(values.tagIds) ? (values.tagIds as string[]) : [],
  }
}

export function BlogRssCollection() {
  const t = useTranslations("adminContent")
  const locale = useLocale()
  const config: AdminCollectionConfig<
    AdminBlogRssFeed,
    AdminBlogRssFeedsResponse
  > = {
    columns: [
      {
        key: "source",
        label: t("rss.sourceColumn"),
        render: (row) => cell(row.name, row.feedUrl),
      },
      {
        key: "category",
        label: t("categoryColumn"),
        hideBelow: "md",
        render: (row) => categoryName(row.categoryId) ?? t("noCategory"),
      },
      {
        key: "sync",
        label: t("rss.syncColumn"),
        hideBelow: "lg",
        render: (row) =>
          t("rss.syncSummary", {
            minutes: row.syncIntervalMinutes,
            max: row.maxItemsPerRun,
          }),
      },
      {
        key: "imports",
        label: t("rss.lastImportColumn"),
        hideBelow: "lg",
        render: (row) =>
          cell(
            row.lastImportedAt ?? t("rss.noImports"),
            t("rss.importCount", { count: row.importCount })
          ),
      },
      {
        key: "status",
        label: t("statusColumn"),
        render: (row) => (
          <Badge variant={row.isActive ? "success" : "neutral"}>
            {row.isActive ? t("rss.active") : t("rss.paused")}
          </Badge>
        ),
      },
    ],
    createLabel: t("rss.create"),
    description: t("rss.description"),
    emptyDescription: t("rss.emptyDescription"),
    emptyTitle: t("rss.emptyTitle"),
    fields: (response) => [
      { kind: "text", label: t("field.name"), name: "name", required: true },
      {
        kind: "text",
        label: t("rss.feedUrl"),
        name: "feedUrl",
        placeholder: "https://ejemplo.com/feed.xml",
        required: true,
      },
      {
        kind: "select",
        label: t("rss.targetCategory"),
        name: "categoryId",
        options: [
          { label: t("noCategory"), value: "none" },
          ...(response?.categories ?? []).map((category) => ({
            label: category.name,
            value: category.id,
          })),
        ],
      },
      {
        kind: "checkboxes",
        label: t("blogPosts.tags"),
        name: "tagIds",
        options: (response?.tags ?? []).map((tag) => ({
          label: tag.name,
          value: tag.id,
        })),
      },
      {
        kind: "number",
        label: t("rss.frequency"),
        name: "syncIntervalMinutes",
        description: t("rss.frequencyHint"),
        required: true,
      },
      {
        kind: "number",
        label: t("rss.maxItems"),
        name: "maxItemsPerRun",
        description: t("rss.maxItemsHint"),
        required: true,
      },
      {
        kind: "textarea",
        label: t("rss.aiPrompt"),
        name: "aiPrompt",
        placeholder: t("rss.aiPromptPlaceholder"),
      },
      { kind: "switch", label: t("field.activeFeminine"), name: "isActive" },
      {
        kind: "switch",
        label: t("rss.autoPublish"),
        name: "autoPublish",
        description: t("rss.autoPublishHint"),
      },
      {
        kind: "switch",
        label: t("rss.aiImprove"),
        name: "aiImprove",
        description: t("rss.aiImproveHint"),
      },
      {
        kind: "switch",
        label: t("rss.aiAutoTranslate"),
        name: "aiAutoTranslate",
        description: t("rss.aiAutoTranslateHint"),
      },
    ],
    filter: {
      label: t("statusColumn"),
      options: [
        { label: t("filter.all"), value: "all" },
        { label: t("rss.activePlural"), value: "active" },
        { label: t("rss.pausedPlural"), value: "inactive" },
      ],
    },
    formDescription: t("rss.formDescription"),
    itemLabel: t("rss.itemLabel"),
    load: (query) => {
      const term = query.q?.trim().toLocaleLowerCase(locale) ?? ""
      const filtered = feedsStore.filter((feed) => {
        const matchesTerm =
          !term ||
          [feed.name, feed.feedUrl, categoryName(feed.categoryId) ?? ""].some(
            (value) => value.toLocaleLowerCase(locale).includes(term)
          )
        const matchesStatus =
          !query.status ||
          query.status === "all" ||
          (query.status === "active" ? feed.isActive : !feed.isActive)
        return matchesTerm && matchesStatus
      })
      return Promise.resolve({
        categories: rssCategories,
        items: filtered.slice(
          (query.page - 1) * query.limit,
          query.page * query.limit
        ),
        tags: rssTags,
        total: filtered.length,
      })
    },
    remove: (row) => {
      feedsStore = feedsStore.filter((feed) => feed.id !== row.id)
      return Promise.resolve()
    },
    rowId: (row) => row.id,
    rowName: (row) => row.name,
    rows: (response) => response.items,
    save: (id, values) => {
      const input = feedInput(values)
      if (id) {
        feedsStore = feedsStore.map((feed) =>
          feed.id === id ? { ...feed, ...input } : feed
        )
      } else {
        feedSequence += 1
        feedsStore = [
          {
            id: `rss-${feedSequence}`,
            importCount: 0,
            lastImportedAt: null,
            ...input,
          },
          ...feedsStore,
        ]
      }
      return Promise.resolve()
    },
    searchPlaceholder: t("rss.searchPlaceholder"),
    title: t("rss.title"),
    toValues: (row) => ({
      aiAutoTranslate: row?.aiAutoTranslate ?? false,
      aiImprove: row?.aiImprove ?? false,
      aiPrompt: row?.aiPrompt ?? "",
      autoPublish: row?.autoPublish ?? true,
      categoryId: row?.categoryId ?? "none",
      feedUrl: row?.feedUrl ?? "",
      isActive: row?.isActive ?? true,
      maxItemsPerRun: row?.maxItemsPerRun ?? 5,
      name: row?.name ?? "",
      syncIntervalMinutes: row?.syncIntervalMinutes ?? 60,
      tagIds: row?.tagIds ?? [],
    }),
    total: (response) => response.total,
  }

  return <AdminCollectionPage config={config} />
}
