"use client"

import {
  FileText,
  FolderTree,
  Globe,
  HelpCircle,
  Sparkles,
  Tags,
} from "lucide-react"

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

const activeFilter = {
  label: "Estado",
  options: [
    { label: "Todos", value: "all" },
    { label: "Activos", value: "active" },
    { label: "Inactivos", value: "inactive" },
  ],
} as const

function activeBadge(isActive: boolean) {
  return (
    <Badge variant={isActive ? "success" : "neutral"}>
      {isActive ? "Activo" : "Inactivo"}
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
        label: "Nombre",
        render: (row) => primary(row.name, row.description || row.slug),
      },
      {
        key: "order",
        label: "Orden",
        hideBelow: "lg",
        render: (row) => row.sortOrder,
      },
      {
        key: "status",
        label: "Estado",
        render: (row) => activeBadge(row.isActive),
      },
    ],
    createLabel: copy.createLabel,
    description: copy.description,
    emptyDescription: copy.emptyDescription,
    emptyIcon: FolderTree,
    emptyTitle: copy.emptyTitle,
    fields: () => [
      { kind: "text", label: "Nombre", name: "name", required: true },
      {
        kind: "textarea",
        label: "Descripción",
        name: "description",
        placeholder: "Para qué sirve esta clasificación.",
      },
      {
        kind: "number",
        label: "Orden",
        name: "sortOrder",
        description: "Menor número aparece primero.",
      },
      { kind: "switch", label: "Activa", name: "isActive" },
    ],
    filter: activeFilter,
    formDescription:
      "El identificador se genera a partir del nombre si no existe uno previo.",
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
    searchPlaceholder: `Buscar ${copy.itemLabel}...`,
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
  const config: AdminCollectionConfig<AdminLanguage, AdminLanguagesResponse> = {
    columns: [
      {
        key: "name",
        label: "Idioma",
        render: (row) => primary(row.name, `${row.nativeName} · ${row.code}`),
      },
      {
        key: "direction",
        label: "Escritura",
        hideBelow: "lg",
        render: (row) =>
          row.direction === "rtl"
            ? "Derecha a izquierda"
            : "Izquierda a derecha",
      },
      {
        key: "status",
        label: "Estado",
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {activeBadge(row.isActive)}
            {row.isDefault ? (
              <Badge variant="info">Predeterminado</Badge>
            ) : null}
          </div>
        ),
      },
    ],
    createLabel: "Nuevo idioma",
    description:
      "Idiomas disponibles para la interfaz y el contenido de la plataforma.",
    emptyDescription: "Añade el primer idioma para publicar contenido.",
    emptyIcon: Globe,
    emptyTitle: "No hay idiomas",
    fields: () => [
      { kind: "text", label: "Nombre", name: "name", required: true },
      {
        kind: "text",
        label: "Nombre nativo",
        name: "nativeName",
        placeholder: "Español",
        required: true,
      },
      {
        kind: "text",
        label: "Código",
        name: "code",
        description: "Código ISO, por ejemplo es o en-US.",
        required: true,
      },
      {
        kind: "select",
        label: "Dirección de escritura",
        name: "direction",
        options: [
          { label: "Izquierda a derecha", value: "ltr" },
          { label: "Derecha a izquierda", value: "rtl" },
        ],
      },
      { kind: "number", label: "Orden", name: "sortOrder" },
      { kind: "switch", label: "Activo", name: "isActive" },
      {
        kind: "switch",
        label: "Predeterminado",
        name: "isDefault",
        description: "Solo un idioma puede serlo; el anterior deja de serlo.",
      },
    ],
    filter: activeFilter,
    formDescription:
      "El idioma predeterminado se usa cuando el contenido no está traducido.",
    itemLabel: "idiomas",
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
    searchPlaceholder: "Buscar idiomas...",
    title: "Idiomas",
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
  return (
    <AdminCollectionPage
      config={taxonomyConfig(adminContentApi.blogCategories, {
        createLabel: "Nueva categoría",
        description: "Clasificaciones que agrupan las entradas del blog.",
        emptyDescription: "Crea una categoría para ordenar las entradas.",
        emptyTitle: "No hay categorías",
        itemLabel: "categorías",
        title: "Categorías del blog",
      })}
    />
  )
}

export function AiTemplateCategoriesCollection() {
  return (
    <AdminCollectionPage
      config={taxonomyConfig(adminContentApi.aiTemplateCategories, {
        createLabel: "Nueva categoría",
        description: "Agrupa las plantillas de IA por caso de uso.",
        emptyDescription: "Crea una categoría para ordenar las plantillas.",
        emptyTitle: "No hay categorías",
        itemLabel: "categorías",
        title: "Categorías de plantillas",
      })}
    />
  )
}

export function BlogTagsCollection() {
  const config: AdminCollectionConfig<AdminBlogTag, AdminBlogTagsResponse> = {
    columns: [
      {
        key: "name",
        label: "Etiqueta",
        render: (row) => primary(row.name, row.slug),
      },
    ],
    createLabel: "Nueva etiqueta",
    description: "Etiquetas transversales para relacionar entradas del blog.",
    emptyDescription: "Crea una etiqueta para agrupar entradas por tema.",
    emptyIcon: Tags,
    emptyTitle: "No hay etiquetas",
    fields: () => [
      { kind: "text", label: "Nombre", name: "name", required: true },
    ],
    formDescription: "El identificador se genera a partir del nombre.",
    itemLabel: "etiquetas",
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
    searchPlaceholder: "Buscar etiquetas...",
    title: "Etiquetas del blog",
    toValues: (row) => ({ name: row?.name ?? "" }),
    total: (response) => response.total,
  }

  return <AdminCollectionPage config={config} />
}

export function BlogPostsCollection() {
  const config: AdminCollectionConfig<AdminBlogPost, AdminBlogPostsResponse> = {
    columns: [
      {
        key: "title",
        label: "Entrada",
        render: (row) => primary(row.title, row.excerpt || row.slug),
      },
      {
        key: "category",
        label: "Categoría",
        hideBelow: "md",
        render: (row) => row.categoryName ?? "Sin categoría",
      },
      {
        key: "status",
        label: "Estado",
        render: (row) => (
          <Badge variant={row.status === "published" ? "success" : "neutral"}>
            {row.status === "published" ? "Publicada" : "Borrador"}
          </Badge>
        ),
      },
    ],
    createLabel: "Nueva entrada",
    description: "Entradas del blog público, sus categorías y etiquetas.",
    emptyDescription: "Publica tu primera entrada para el blog.",
    emptyIcon: FileText,
    emptyTitle: "No hay entradas",
    fields: (response) => [
      { kind: "text", label: "Título", name: "title", required: true },
      {
        kind: "textarea",
        label: "Resumen",
        name: "excerpt",
        placeholder: "Una o dos frases que resuman la entrada.",
      },
      { kind: "textarea", label: "Contenido", name: "content" },
      {
        kind: "select",
        label: "Estado",
        name: "status",
        options: [
          { label: "Borrador", value: "draft" },
          { label: "Publicada", value: "published" },
        ],
      },
      {
        kind: "select",
        label: "Categoría",
        name: "categoryId",
        options: (response?.categories ?? []).map((category) => ({
          label: category.name,
          value: category.id,
        })),
      },
      {
        kind: "checkboxes",
        label: "Etiquetas",
        name: "tagIds",
        options: (response?.tags ?? []).map((tag) => ({
          label: tag.name,
          value: tag.id,
        })),
      },
    ],
    filter: {
      label: "Estado",
      options: [
        { label: "Todos", value: "all" },
        { label: "Publicadas", value: "published" },
        { label: "Borradores", value: "draft" },
      ],
    },
    formDescription:
      "Al publicar se registra la fecha; volver a borrador la retira.",
    itemLabel: "entradas",
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
    searchPlaceholder: "Buscar entradas...",
    title: "Blog",
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
  const config: AdminCollectionConfig<AdminFaq, AdminFaqsResponse> = {
    columns: [
      {
        key: "question",
        label: "Pregunta",
        render: (row) => primary(row.question, row.answer.slice(0, 120)),
      },
      {
        key: "order",
        label: "Orden",
        hideBelow: "lg",
        render: (row) => row.sortOrder,
      },
      {
        key: "status",
        label: "Estado",
        render: (row) => activeBadge(row.isActive),
      },
    ],
    createLabel: "Nueva pregunta",
    description: "Preguntas frecuentes visibles para los clientes.",
    emptyDescription: "Añade la primera pregunta frecuente.",
    emptyIcon: HelpCircle,
    emptyTitle: "No hay preguntas",
    fields: () => [
      { kind: "text", label: "Pregunta", name: "question", required: true },
      {
        kind: "textarea",
        label: "Respuesta",
        name: "answer",
        required: true,
      },
      { kind: "number", label: "Orden", name: "sortOrder" },
      { kind: "switch", label: "Visible", name: "isActive" },
    ],
    filter: activeFilter,
    formDescription: "Se muestran ordenadas de menor a mayor.",
    itemLabel: "preguntas",
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
    searchPlaceholder: "Buscar preguntas...",
    title: "Preguntas frecuentes",
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
  const config: AdminCollectionConfig<
    AdminAiTemplate,
    AdminAiTemplatesResponse
  > = {
    columns: [
      {
        key: "name",
        label: "Plantilla",
        render: (row) => primary(row.name, row.description || row.slug),
      },
      {
        key: "category",
        label: "Categoría",
        hideBelow: "md",
        render: (row) => row.categoryName ?? "Sin categoría",
      },
      {
        key: "status",
        label: "Estado",
        render: (row) => activeBadge(row.isActive),
      },
    ],
    createLabel: "Nueva plantilla",
    description:
      "Prompts reutilizables que el Portal ofrece dentro de AI Studio.",
    emptyDescription: "Crea una plantilla para acelerar las generaciones.",
    emptyIcon: Sparkles,
    emptyTitle: "No hay plantillas",
    fields: (response) => [
      { kind: "text", label: "Nombre", name: "name", required: true },
      { kind: "textarea", label: "Descripción", name: "description" },
      {
        kind: "textarea",
        label: "Prompt",
        name: "prompt",
        placeholder: "Instrucción que recibirá el modelo.",
        required: true,
      },
      {
        kind: "select",
        label: "Categoría",
        name: "categoryId",
        options: (response?.categories ?? []).map((category) => ({
          label: category.name,
          value: category.id,
        })),
      },
      { kind: "number", label: "Orden", name: "sortOrder" },
      { kind: "switch", label: "Activa", name: "isActive" },
    ],
    filter: activeFilter,
    formDescription: "Las plantillas activas aparecen en el Portal.",
    itemLabel: "plantillas",
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
    searchPlaceholder: "Buscar plantillas...",
    title: "Plantillas de IA",
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
