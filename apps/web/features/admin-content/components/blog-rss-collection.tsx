"use client"

import { useLocale, useTranslations } from "next-intl"

import { Badge } from "@workspace/ui/components/badge"

import {
  type AdminBlogRssFeed,
  type AdminBlogRssFeedsResponse,
  initialFeeds,
  rssCategories,
  rssTags,
} from "../fixtures/blog-rss"
import {
  AdminCollectionPage,
  type AdminCollectionConfig,
  type CollectionValues,
} from "./admin-collection-page"

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
