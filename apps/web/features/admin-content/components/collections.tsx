"use client"

import { useTranslations } from "next-intl"

import { adminContentApi } from "@workspace/api-client"
import type {
  AdminAiTemplate,
  AdminAiTemplatesResponse,
  AdminBlogPost,
  AdminBlogPostsResponse,
  AdminBlogTag,
  AdminBlogTagsResponse,
  AdminFaq,
  AdminFaqsResponse,
  AdminLanguage,
  AdminLanguagesResponse,
  AdminTaxonomy,
  AdminTaxonomiesResponse,
} from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"

import {
  AdminCollectionPage,
  type AdminCollectionConfig,
  type CollectionValues,
} from "./admin-collection-page"

type Translate = ReturnType<typeof useTranslations<"adminContent">>

function activeFilter(t: Translate) {
  return {
    label: t("statusColumn"),
    options: [
      { label: t("filter.all"), value: "all" },
      { label: t("filter.active"), value: "active" },
      { label: t("filter.inactive"), value: "inactive" },
    ],
  }
}

function ActiveBadge({ isActive, t }: { isActive: boolean; t: Translate }) {
  return (
    <Badge variant={isActive ? "success" : "neutral"}>
      {isActive ? t("active") : t("inactive")}
    </Badge>
  )
}

function primary(title: string, detail?: string | null) {
  return (
    <div className="flex min-w-40 flex-col">
      <span className="font-medium">{title}</span>
      {detail ? (
        <span className="text-sm text-muted-foreground">{detail}</span>
      ) : null}
    </div>
  )
}

function taxonomyConfig(
  resource: typeof adminContentApi.blogCategories,
  t: Translate,
  copy: {
    createLabel: string
    description: string
    emptyDescription: string
    emptyTitle: string
    itemLabel: string
    title: string
  }
): AdminCollectionConfig<AdminTaxonomy, AdminTaxonomiesResponse> {
  return {
    columns: [
      {
        key: "name",
        label: t("field.name"),
        render: (row) => primary(row.name, row.description || row.slug),
      },
      {
        key: "order",
        label: t("field.order"),
        hideBelow: "lg",
        render: (row) => row.sortOrder,
      },
      {
        key: "status",
        label: t("statusColumn"),
        render: (row) => <ActiveBadge isActive={row.isActive} t={t} />,
      },
    ],
    createLabel: copy.createLabel,
    description: copy.description,
    emptyDescription: copy.emptyDescription,
    emptyTitle: copy.emptyTitle,
    fields: () => [
      { kind: "text", label: t("field.name"), name: "name", required: true },
      {
        kind: "textarea",
        label: t("field.description"),
        name: "description",
        placeholder: t("taxonomy.descriptionPlaceholder"),
      },
      {
        kind: "number",
        label: t("field.order"),
        name: "sortOrder",
        description: t("field.orderHint"),
      },
      { kind: "switch", label: t("field.activeFeminine"), name: "isActive" },
    ],
    filter: activeFilter(t),
    formDescription: t("taxonomy.formDescription"),
    itemLabel: copy.itemLabel,
    load: (query) => resource.list(query),
    remove: (row) => resource.remove(row.id),
    rowId: (row) => row.id,
    rowName: (row) => row.name,
    rows: (response) => response.items,
    save: async (id, values) => {
      const input = taxonomyInput(values)
      if (id) await resource.update(id, input)
      else await resource.create(input)
    },
    searchPlaceholder: t("searchItems", { items: copy.itemLabel }),
    title: copy.title,
    toValues: (row) => ({
      description: row?.description ?? "",
      isActive: row?.isActive ?? true,
      name: row?.name ?? "",
      sortOrder: row?.sortOrder ?? 0,
    }),
    total: (response) => response.total,
  }
}

function taxonomyInput(values: CollectionValues) {
  return {
    description: String(values.description ?? ""),
    isActive: Boolean(values.isActive),
    name: String(values.name ?? ""),
    sortOrder: Number(values.sortOrder ?? 0) || 0,
  }
}

export function LanguagesCollection() {
  const t = useTranslations("adminContent")
  const config: AdminCollectionConfig<AdminLanguage, AdminLanguagesResponse> = {
    columns: [
      {
        key: "name",
        label: t("languages.column"),
        render: (row) => primary(row.name, `${row.nativeName} · ${row.code}`),
      },
      {
        key: "direction",
        label: t("languages.directionColumn"),
        hideBelow: "lg",
        render: (row) =>
          row.direction === "rtl" ? t("languages.rtl") : t("languages.ltr"),
      },
      {
        key: "status",
        label: t("statusColumn"),
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            <ActiveBadge isActive={row.isActive} t={t} />
            {row.isDefault ? (
              <Badge variant="info">{t("languages.default")}</Badge>
            ) : null}
          </div>
        ),
      },
    ],
    createLabel: t("languages.create"),
    description: t("languages.description"),
    emptyDescription: t("languages.emptyDescription"),
    emptyTitle: t("languages.emptyTitle"),
    fields: () => [
      { kind: "text", label: t("field.name"), name: "name", required: true },
      {
        kind: "text",
        label: t("languages.nativeName"),
        name: "nativeName",
        placeholder: t("languages.nativeNamePlaceholder"),
        required: true,
      },
      {
        kind: "text",
        label: t("languages.code"),
        name: "code",
        description: t("languages.codeHint"),
        required: true,
      },
      {
        kind: "select",
        label: t("languages.direction"),
        name: "direction",
        options: [
          { label: t("languages.ltr"), value: "ltr" },
          { label: t("languages.rtl"), value: "rtl" },
        ],
      },
      { kind: "number", label: t("field.order"), name: "sortOrder" },
      { kind: "switch", label: t("field.active"), name: "isActive" },
      {
        kind: "switch",
        label: t("languages.default"),
        name: "isDefault",
        description: t("languages.defaultHint"),
      },
    ],
    filter: activeFilter(t),
    formDescription: t("languages.formDescription"),
    itemLabel: t("languages.itemLabel"),
    load: (query) => adminContentApi.languages.list(query),
    remove: (row) => adminContentApi.languages.remove(row.id),
    rowId: (row) => row.id,
    rowName: (row) => row.name,
    rows: (response) => response.languages,
    save: async (id, values) => {
      const input = {
        code: String(values.code ?? ""),
        direction: (values.direction === "rtl" ? "rtl" : "ltr") as
          "ltr" | "rtl",
        isActive: Boolean(values.isActive),
        isDefault: Boolean(values.isDefault),
        name: String(values.name ?? ""),
        nativeName: String(values.nativeName ?? ""),
        sortOrder: Number(values.sortOrder ?? 0) || 0,
      }
      if (id) await adminContentApi.languages.update(id, input)
      else await adminContentApi.languages.create(input)
    },
    searchPlaceholder: t("languages.searchPlaceholder"),
    title: t("languages.title"),
    toValues: (row) => ({
      code: row?.code ?? "",
      direction: row?.direction ?? "ltr",
      isActive: row?.isActive ?? true,
      isDefault: row?.isDefault ?? false,
      name: row?.name ?? "",
      nativeName: row?.nativeName ?? "",
      sortOrder: row?.sortOrder ?? 0,
    }),
    total: (response) => response.total,
  }

  return <AdminCollectionPage config={config} />
}

export function BlogCategoriesCollection() {
  const t = useTranslations("adminContent")
  return (
    <AdminCollectionPage
      config={taxonomyConfig(adminContentApi.blogCategories, t, {
        createLabel: t("blogCategories.create"),
        description: t("blogCategories.description"),
        emptyDescription: t("blogCategories.emptyDescription"),
        emptyTitle: t("blogCategories.emptyTitle"),
        itemLabel: t("blogCategories.itemLabel"),
        title: t("blogCategories.title"),
      })}
    />
  )
}

export function AiTemplateCategoriesCollection() {
  const t = useTranslations("adminContent")
  return (
    <AdminCollectionPage
      config={taxonomyConfig(adminContentApi.aiTemplateCategories, t, {
        createLabel: t("aiTemplateCategories.create"),
        description: t("aiTemplateCategories.description"),
        emptyDescription: t("aiTemplateCategories.emptyDescription"),
        emptyTitle: t("aiTemplateCategories.emptyTitle"),
        itemLabel: t("aiTemplateCategories.itemLabel"),
        title: t("aiTemplateCategories.title"),
      })}
    />
  )
}

export function BlogTagsCollection() {
  const t = useTranslations("adminContent")
  const config: AdminCollectionConfig<AdminBlogTag, AdminBlogTagsResponse> = {
    columns: [
      {
        key: "name",
        label: t("blogTags.column"),
        render: (row) => primary(row.name, row.slug),
      },
    ],
    createLabel: t("blogTags.create"),
    description: t("blogTags.description"),
    emptyDescription: t("blogTags.emptyDescription"),
    emptyTitle: t("blogTags.emptyTitle"),
    fields: () => [
      { kind: "text", label: t("field.name"), name: "name", required: true },
    ],
    formDescription: t("blogTags.formDescription"),
    itemLabel: t("blogTags.itemLabel"),
    load: (query) => adminContentApi.blogTags.list(query),
    remove: (row) => adminContentApi.blogTags.remove(row.id),
    rowId: (row) => row.id,
    rowName: (row) => row.name,
    rows: (response) => response.items,
    save: async (id, values) => {
      const input = { name: String(values.name ?? "") }
      if (id) await adminContentApi.blogTags.update(id, input)
      else await adminContentApi.blogTags.create(input)
    },
    searchPlaceholder: t("blogTags.searchPlaceholder"),
    title: t("blogTags.title"),
    toValues: (row) => ({ name: row?.name ?? "" }),
    total: (response) => response.total,
  }

  return <AdminCollectionPage config={config} />
}

export function BlogPostsCollection() {
  const t = useTranslations("adminContent")
  const config: AdminCollectionConfig<AdminBlogPost, AdminBlogPostsResponse> = {
    columns: [
      {
        key: "title",
        label: t("blogPosts.column"),
        render: (row) => primary(row.title, row.excerpt || row.slug),
      },
      {
        key: "category",
        label: t("categoryColumn"),
        hideBelow: "md",
        render: (row) => row.categoryName ?? t("noCategory"),
      },
      {
        key: "status",
        label: t("statusColumn"),
        render: (row) => (
          <Badge variant={row.status === "published" ? "success" : "neutral"}>
            {row.status === "published"
              ? t("blogPosts.published")
              : t("blogPosts.draft")}
          </Badge>
        ),
      },
    ],
    createLabel: t("blogPosts.create"),
    description: t("blogPosts.description"),
    emptyDescription: t("blogPosts.emptyDescription"),
    emptyTitle: t("blogPosts.emptyTitle"),
    fields: (response) => [
      {
        kind: "text",
        label: t("blogPosts.titleField"),
        name: "title",
        required: true,
      },
      {
        kind: "textarea",
        label: t("blogPosts.excerpt"),
        name: "excerpt",
        placeholder: t("blogPosts.excerptPlaceholder"),
      },
      { kind: "textarea", label: t("blogPosts.content"), name: "content" },
      {
        kind: "select",
        label: t("statusColumn"),
        name: "status",
        options: [
          { label: t("blogPosts.draft"), value: "draft" },
          { label: t("blogPosts.published"), value: "published" },
        ],
      },
      {
        kind: "select",
        label: t("categoryColumn"),
        name: "categoryId",
        options: (response?.categories ?? []).map((category) => ({
          label: category.name,
          value: category.id,
        })),
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
    ],
    filter: {
      label: t("statusColumn"),
      options: [
        { label: t("filter.all"), value: "all" },
        { label: t("blogPosts.publishedPlural"), value: "published" },
        { label: t("blogPosts.draftPlural"), value: "draft" },
      ],
    },
    formDescription: t("blogPosts.formDescription"),
    itemLabel: t("blogPosts.itemLabel"),
    load: (query) => adminContentApi.blogPosts.list(query),
    remove: (row) => adminContentApi.blogPosts.remove(row.id),
    rowId: (row) => row.id,
    rowName: (row) => row.title,
    rows: (response) => response.posts,
    save: async (id, values) => {
      const input = {
        categoryId: values.categoryId ? String(values.categoryId) : null,
        content: String(values.content ?? ""),
        excerpt: String(values.excerpt ?? ""),
        status: (values.status === "published" ? "published" : "draft") as
          "draft" | "published",
        tagIds: Array.isArray(values.tagIds) ? (values.tagIds as string[]) : [],
        title: String(values.title ?? ""),
      }
      if (id) await adminContentApi.blogPosts.update(id, input)
      else await adminContentApi.blogPosts.create(input)
    },
    searchPlaceholder: t("blogPosts.searchPlaceholder"),
    title: t("blogPosts.title"),
    toValues: (row) => ({
      categoryId: row?.categoryId ?? "",
      content: row?.content ?? "",
      excerpt: row?.excerpt ?? "",
      status: row?.status ?? "draft",
      tagIds: row?.tagIds ?? [],
      title: row?.title ?? "",
    }),
    total: (response) => response.total,
  }

  return <AdminCollectionPage config={config} />
}

export function FaqsCollection() {
  const t = useTranslations("adminContent")
  const config: AdminCollectionConfig<AdminFaq, AdminFaqsResponse> = {
    columns: [
      {
        key: "question",
        label: t("faqs.question"),
        render: (row) => primary(row.question, row.answer.slice(0, 120)),
      },
      {
        key: "order",
        label: t("field.order"),
        hideBelow: "lg",
        render: (row) => row.sortOrder,
      },
      {
        key: "status",
        label: t("statusColumn"),
        render: (row) => <ActiveBadge isActive={row.isActive} t={t} />,
      },
    ],
    createLabel: t("faqs.create"),
    description: t("faqs.description"),
    emptyDescription: t("faqs.emptyDescription"),
    emptyTitle: t("faqs.emptyTitle"),
    fields: () => [
      {
        kind: "text",
        label: t("faqs.question"),
        name: "question",
        required: true,
      },
      {
        kind: "textarea",
        label: t("faqs.answer"),
        name: "answer",
        required: true,
      },
      { kind: "number", label: t("field.order"), name: "sortOrder" },
      { kind: "switch", label: t("faqs.visible"), name: "isActive" },
    ],
    filter: activeFilter(t),
    formDescription: t("faqs.formDescription"),
    itemLabel: t("faqs.itemLabel"),
    load: (query) => adminContentApi.faqs.list(query),
    remove: (row) => adminContentApi.faqs.remove(row.id),
    rowId: (row) => row.id,
    rowName: (row) => row.question,
    rows: (response) => response.items,
    save: async (id, values) => {
      const input = {
        answer: String(values.answer ?? ""),
        isActive: Boolean(values.isActive),
        question: String(values.question ?? ""),
        sortOrder: Number(values.sortOrder ?? 0) || 0,
      }
      if (id) await adminContentApi.faqs.update(id, input)
      else await adminContentApi.faqs.create(input)
    },
    searchPlaceholder: t("faqs.searchPlaceholder"),
    title: t("faqs.title"),
    toValues: (row) => ({
      answer: row?.answer ?? "",
      isActive: row?.isActive ?? true,
      question: row?.question ?? "",
      sortOrder: row?.sortOrder ?? 0,
    }),
    total: (response) => response.total,
  }

  return <AdminCollectionPage config={config} />
}

export function AiTemplatesCollection() {
  const t = useTranslations("adminContent")
  const config: AdminCollectionConfig<
    AdminAiTemplate,
    AdminAiTemplatesResponse
  > = {
    columns: [
      {
        key: "name",
        label: t("aiTemplates.column"),
        render: (row) => primary(row.name, row.description || row.slug),
      },
      {
        key: "category",
        label: t("categoryColumn"),
        hideBelow: "md",
        render: (row) => row.categoryName ?? t("noCategory"),
      },
      {
        key: "status",
        label: t("statusColumn"),
        render: (row) => <ActiveBadge isActive={row.isActive} t={t} />,
      },
    ],
    createLabel: t("aiTemplates.create"),
    description: t("aiTemplates.description"),
    emptyDescription: t("aiTemplates.emptyDescription"),
    emptyTitle: t("aiTemplates.emptyTitle"),
    fields: (response) => [
      { kind: "text", label: t("field.name"), name: "name", required: true },
      { kind: "textarea", label: t("field.description"), name: "description" },
      {
        kind: "textarea",
        label: t("aiTemplates.prompt"),
        name: "prompt",
        placeholder: t("aiTemplates.promptPlaceholder"),
        required: true,
      },
      {
        kind: "select",
        label: t("categoryColumn"),
        name: "categoryId",
        options: (response?.categories ?? []).map((category) => ({
          label: category.name,
          value: category.id,
        })),
      },
      { kind: "number", label: t("field.order"), name: "sortOrder" },
      { kind: "switch", label: t("field.activeFeminine"), name: "isActive" },
    ],
    filter: activeFilter(t),
    formDescription: t("aiTemplates.formDescription"),
    itemLabel: t("aiTemplates.itemLabel"),
    load: (query) => adminContentApi.aiTemplates.list(query),
    remove: (row) => adminContentApi.aiTemplates.remove(row.id),
    rowId: (row) => row.id,
    rowName: (row) => row.name,
    rows: (response) => response.templates,
    save: async (id, values) => {
      const input = {
        categoryId: values.categoryId ? String(values.categoryId) : null,
        description: String(values.description ?? ""),
        isActive: Boolean(values.isActive),
        name: String(values.name ?? ""),
        prompt: String(values.prompt ?? ""),
        sortOrder: Number(values.sortOrder ?? 0) || 0,
      }
      if (id) await adminContentApi.aiTemplates.update(id, input)
      else await adminContentApi.aiTemplates.create(input)
    },
    searchPlaceholder: t("aiTemplates.searchPlaceholder"),
    title: t("aiTemplates.title"),
    toValues: (row) => ({
      categoryId: row?.categoryId ?? "",
      description: row?.description ?? "",
      isActive: row?.isActive ?? true,
      name: row?.name ?? "",
      prompt: row?.prompt ?? "",
      sortOrder: row?.sortOrder ?? 0,
    }),
    total: (response) => response.total,
  }

  return <AdminCollectionPage config={config} />
}
