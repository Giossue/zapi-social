"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  ExternalLink,
  Eye,
  Link2,
  LockKeyhole,
  MoreHorizontal,
  MousePointerClick,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { ApiError, linkBioApi } from "@workspace/api-client"
import type {
  LinkBioBlock,
  LinkBioBlockType,
  PortalLinkBioPage,
  PortalLinkBioPagesResponse,
  UpsertPortalLinkBioPageInput,
} from "@workspace/contracts"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { Input } from "@workspace/ui/components/input"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import {
  blockHints,
  blockLabels,
  blockTypes,
  emptyBlock,
  emptyItem,
  itemBlockTypes,
  templates,
} from "./link-bio-blocks"
import { loginPath } from "@/features/identity/login-redirect"

const pageSize = 10

type Draft = UpsertPortalLinkBioPageInput

const emptyDraft: Draft = {
  appearance: {
    accent: "primary",
    avatarStyle: "circle",
    backgroundFit: "cover",
    backgroundOverlay: 28,
    backgroundPosition: "center",
    brandingText: "",
    buttonStyle: "rounded",
    contentAlign: "center",
  },
  avatarFileAssetId: null,
  blocks: [emptyBlock("links")],
  coverFileAssetId: null,
  description: "",
  headline: "",
  status: "draft",
  templateKey: "aurora",
  title: "",
}

function draftFrom(page: PortalLinkBioPage): Draft {
  return {
    appearance: page.appearance,
    avatarFileAssetId: page.avatarFileAssetId,
    blocks: page.blocks,
    coverFileAssetId: page.coverFileAssetId,
    description: page.description,
    headline: page.headline,
    slug: page.slug,
    status: page.status,
    templateKey: page.templateKey,
    title: page.title,
  }
}

function BlockEditor({
  block,
  index,
  onChange,
  onMove,
  onRemove,
  total,
}: {
  block: LinkBioBlock
  index: number
  onChange: (next: LinkBioBlock) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  total: number
}) {
  const hasItems = itemBlockTypes.includes(block.type)

  return (
    <Card variant="inset">
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">{blockLabels[block.type]}</span>
            <span className="text-sm text-muted-foreground">
              {blockHints[block.type]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Switch
              aria-label={`Mostrar ${blockLabels[block.type]}`}
              checked={block.enabled}
              onCheckedChange={(enabled) => onChange({ ...block, enabled })}
            />
            <Button
              aria-label="Subir bloque"
              disabled={index === 0}
              onClick={() => onMove(-1)}
              size="icon-sm"
              type="button"
              variant="brand-secondary"
            >
              <ArrowUp />
            </Button>
            <Button
              aria-label="Bajar bloque"
              disabled={index === total - 1}
              onClick={() => onMove(1)}
              size="icon-sm"
              type="button"
              variant="brand-secondary"
            >
              <ArrowDown />
            </Button>
            <Button
              aria-label="Quitar bloque"
              onClick={onRemove}
              size="icon-sm"
              type="button"
              variant="destructive"
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`block-${index}-title`}>Título</FieldLabel>
            <Input
              id={`block-${index}-title`}
              onChange={(event) =>
                onChange({ ...block, title: event.target.value })
              }
              value={block.title}
            />
          </Field>
          {block.type === "header" || block.type === "embed" ? (
            <Field>
              <FieldLabel htmlFor={`block-${index}-content`}>
                {block.type === "embed" ? "Código o URL" : "Texto"}
              </FieldLabel>
              <Textarea
                id={`block-${index}-content`}
                onChange={(event) =>
                  onChange({ ...block, content: event.target.value })
                }
                rows={3}
                value={block.content}
              />
            </Field>
          ) : null}
          {block.type === "video" ? (
            <Field>
              <FieldLabel htmlFor={`block-${index}-url`}>
                URL del video
              </FieldLabel>
              <Input
                id={`block-${index}-url`}
                onChange={(event) =>
                  onChange({ ...block, url: event.target.value })
                }
                placeholder="https://youtube.com/watch?v=…"
                value={block.url}
              />
            </Field>
          ) : null}
        </FieldGroup>

        {hasItems ? (
          <div className="flex flex-col gap-3">
            <Separator />
            {block.items.map((item, itemIndex) => (
              <div
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                key={itemIndex}
              >
                <Input
                  aria-label="Etiqueta"
                  onChange={(event) =>
                    onChange({
                      ...block,
                      items: block.items.map((current, position) =>
                        position === itemIndex
                          ? { ...current, label: event.target.value }
                          : current
                      ),
                    })
                  }
                  placeholder={block.type === "faq" ? "Pregunta" : "Etiqueta"}
                  value={item.label}
                />
                <Input
                  aria-label={block.type === "faq" ? "Respuesta" : "Destino"}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      items: block.items.map((current, position) =>
                        position === itemIndex
                          ? block.type === "faq"
                            ? { ...current, answer: event.target.value }
                            : { ...current, url: event.target.value }
                          : current
                      ),
                    })
                  }
                  placeholder={block.type === "faq" ? "Respuesta" : "https://…"}
                  value={block.type === "faq" ? item.answer : item.url}
                />
                <Button
                  aria-label="Quitar elemento"
                  onClick={() =>
                    onChange({
                      ...block,
                      items: block.items.filter(
                        (_, position) => position !== itemIndex
                      ),
                    })
                  }
                  size="icon-sm"
                  type="button"
                  variant="brand-secondary"
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              className="w-fit"
              onClick={() =>
                onChange({ ...block, items: [...block.items, emptyItem()] })
              }
              size="sm"
              type="button"
              variant="brand-secondary"
            >
              <Plus data-icon="inline-start" /> Añadir elemento
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function PageSheet({
  onOpenChange,
  onSubmit,
  open,
  page,
  pending,
}: {
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: Draft) => Promise<boolean>
  open: boolean
  page: PortalLinkBioPage | null
  pending: boolean
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  useEffect(() => {
    if (open) setDraft(page ? draftFrom(page) : emptyDraft)
  }, [open, page])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.title.trim()) {
      toast.error("La página necesita un título.")
      return
    }
    if (await onSubmit(draft)) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-none data-[side=right]:sm:w-full data-[side=right]:sm:border-l-0"
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{page ? "Editar página" : "Nueva página"}</SheetTitle>
          <SheetDescription>
            Los bloques se muestran en el mismo orden en la página pública.
          </SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <div className="mx-auto grid w-full max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex flex-col gap-4">
                <span className="font-medium">Bloques</span>
                {draft.blocks.map((block, index) => (
                  <BlockEditor
                    block={block}
                    index={index}
                    key={index}
                    onChange={(next) =>
                      setDraft({
                        ...draft,
                        blocks: draft.blocks.map((current, position) =>
                          position === index ? next : current
                        ),
                      })
                    }
                    onMove={(direction) => {
                      const target = index + direction
                      if (target < 0 || target >= draft.blocks.length) return
                      const blocks = [...draft.blocks]
                      const [moved] = blocks.splice(index, 1)
                      blocks.splice(target, 0, moved!)
                      setDraft({ ...draft, blocks })
                    }}
                    onRemove={() =>
                      setDraft({
                        ...draft,
                        blocks: draft.blocks.filter(
                          (_, position) => position !== index
                        ),
                      })
                    }
                    total={draft.blocks.length}
                  />
                ))}
                <Select
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      blocks: [
                        ...draft.blocks,
                        emptyBlock(value as LinkBioBlockType),
                      ],
                    })
                  }
                  value=""
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Añadir bloque…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {blockTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {blockLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="page-title">
                    Título{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                    <span className="sr-only"> obligatorio</span>
                  </FieldLabel>
                  <Input
                    aria-required="true"
                    id="page-title"
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                    value={draft.title}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="page-slug">Dirección</FieldLabel>
                  <Input
                    id="page-slug"
                    onChange={(event) =>
                      setDraft({ ...draft, slug: event.target.value })
                    }
                    placeholder="mi-marca"
                    value={draft.slug ?? ""}
                  />
                  <FieldDescription>
                    Se genera del título si la dejas vacía.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="page-headline">Titular</FieldLabel>
                  <Input
                    id="page-headline"
                    onChange={(event) =>
                      setDraft({ ...draft, headline: event.target.value })
                    }
                    value={draft.headline}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="page-description">
                    Descripción
                  </FieldLabel>
                  <Textarea
                    id="page-description"
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                    rows={3}
                    value={draft.description}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="page-template">Plantilla</FieldLabel>
                  <Select
                    onValueChange={(value) =>
                      setDraft({
                        ...draft,
                        templateKey: value as Draft["templateKey"],
                      })
                    }
                    value={draft.templateKey}
                  >
                    <SelectTrigger className="w-full" id="page-template">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {templates.map((template) => (
                          <SelectItem key={template.key} value={template.key}>
                            {template.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {templates.find((item) => item.key === draft.templateKey)
                      ?.description ?? ""}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="page-align">Alineación</FieldLabel>
                  <Select
                    onValueChange={(value) =>
                      setDraft({
                        ...draft,
                        appearance: {
                          ...draft.appearance,
                          contentAlign: value as "left" | "center",
                        },
                      })
                    }
                    value={draft.appearance.contentAlign}
                  >
                    <SelectTrigger className="w-full" id="page-align">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="center">Centrado</SelectItem>
                        <SelectItem value="left">A la izquierda</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="page-buttons">Botones</FieldLabel>
                  <Select
                    onValueChange={(value) =>
                      setDraft({
                        ...draft,
                        appearance: {
                          ...draft.appearance,
                          buttonStyle: value as "rounded" | "pill" | "square",
                        },
                      })
                    }
                    value={draft.appearance.buttonStyle}
                  >
                    <SelectTrigger className="w-full" id="page-buttons">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="rounded">Redondeados</SelectItem>
                        <SelectItem value="pill">Píldora</SelectItem>
                        <SelectItem value="square">Rectos</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="horizontal">
                  <Switch
                    checked={draft.status === "published"}
                    id="page-published"
                    onCheckedChange={(checked) =>
                      setDraft({
                        ...draft,
                        status: checked ? "published" : "draft",
                      })
                    }
                  />
                  <FieldLabel htmlFor="page-published">
                    <FieldContent>
                      <FieldTitle>Publicada</FieldTitle>
                      <FieldDescription>
                        Solo las publicadas son visibles en su dirección.
                      </FieldDescription>
                    </FieldContent>
                  </FieldLabel>
                </Field>
              </FieldGroup>
            </div>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              Cancelar
            </Button>
            <Button disabled={pending || !draft.title.trim()} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              Guardar página
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function LinkBioPage() {
  const router = useRouter()
  const [data, setData] = useState<PortalLinkBioPagesResponse | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    PortalLinkBioPage["status"] | "all"
  >("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PortalLinkBioPage | null>(null)
  const [toDelete, setToDelete] = useState<PortalLinkBioPage | null>(null)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return true
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return true
      }
      return false
    },
    [router]
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setData(await linkBioApi.list())
      setForbidden(false)
    } catch (error) {
      if (handleError(error)) return
      console.error("Link bio request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    void load()
  }, [load])

  async function save(draft: Draft) {
    setPending(true)
    try {
      if (editing) await linkBioApi.update(editing.id, draft)
      else await linkBioApi.create(draft)
      await load()
      toast.success(editing ? "Página actualizada." : "Página creada.")
      return true
    } catch (error) {
      if (handleError(error)) return false
      if (error instanceof ApiError && error.code === "LINK_BIO_SLUG_TAKEN") {
        toast.error("Esa dirección ya está en uso.")
        return false
      }
      console.error("Link bio save failed", error)
      toast.error("No pudimos guardar la página. Inténtalo de nuevo.")
      return false
    } finally {
      setPending(false)
    }
  }

  async function remove(page: PortalLinkBioPage) {
    setPending(true)
    try {
      await linkBioApi.remove(page.id)
      setToDelete(null)
      await load()
      toast.success("Página eliminada.")
    } catch (error) {
      if (handleError(error)) return
      console.error("Link bio deletion failed", error)
      toast.error("No pudimos eliminar la página.")
    } finally {
      setPending(false)
    }
  }

  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description="Tu acceso actual no permite administrar las páginas de enlaces."
            icon={LockKeyhole}
            title="Link in bio no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !data && !loadError) {
    return <PageLoading aria-label="Cargando páginas de enlaces" />
  }

  if (loadError || !data) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton
                onClick={() => void load()}
                variant="brand-secondary"
              />
            }
            description="No pudimos cargar tus páginas de enlaces."
            icon={CircleAlert}
            title="Link in bio no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredPages = data.pages.filter((page) => {
    const matchesQuery =
      !normalizedQuery ||
      page.title.toLowerCase().includes(normalizedQuery) ||
      page.slug.toLowerCase().includes(normalizedQuery)
    const matchesStatus = statusFilter === "all" || page.status === statusFilter
    return matchesQuery && matchesStatus
  })
  const hasFilters = Boolean(query || statusFilter !== "all")
  const pageCount = Math.max(1, Math.ceil(filteredPages.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)
  const visiblePages = filteredPages.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )
  const rangeStart = filteredPages.length ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = filteredPages.length
    ? rangeStart + visiblePages.length - 1
    : 0

  function clearFilters() {
    setQuery("")
    setStatusFilter("all")
    setCurrentPage(1)
  }

  function openCreate() {
    setEditing(null)
    setIsSheetOpen(true)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description="Una página pública con todos tus enlaces, y sus métricas de visitas y clics."
          title="Link in bio"
        />
        <CardGrid layout="md-3">
          <MetricCard
            description="Creadas en este espacio"
            icon={Link2}
            label="Páginas"
            value={data.metrics.total}
          />
          <MetricCard
            description="Visitas registradas"
            icon={Eye}
            label="Vistas"
            value={data.metrics.views}
          />
          <MetricCard
            description="Clics en tus enlaces"
            icon={MousePointerClick}
            label="Clics"
            value={data.metrics.clicks}
          />
        </CardGrid>
        <Card variant="subtle">
          <DataTableHeader
            action={
              data.canManage ? (
                <Button
                  className="hidden sm:inline-flex"
                  onClick={openCreate}
                  size="sm"
                  type="button"
                >
                  <Plus data-icon="inline-start" /> Nueva página
                </Button>
              ) : undefined
            }
            search={{
              ariaLabel: "Buscar páginas",
              onChange: (value) => {
                setQuery(value)
                setCurrentPage(1)
              },
              placeholder: "Buscar páginas...",
              value: query,
            }}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar
              actions={
                hasFilters ? (
                  <Button
                    onClick={clearFilters}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <X /> Limpiar
                  </Button>
                ) : undefined
              }
            >
              <DataTableFilter
                ariaLabel="Filtrar por estado"
                label="Estado"
                onValueChange={(value) => {
                  setStatusFilter(value as PortalLinkBioPage["status"] | "all")
                  setCurrentPage(1)
                }}
                options={[
                  { label: "Todos", value: "all" },
                  { label: "Publicada", value: "published" },
                  { label: "Borrador", value: "draft" },
                ]}
                value={statusFilter}
              />
            </DataTableToolbar>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Página</TableHead>
                  <TableHead>Rendimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  {data.canManage ? (
                    <TableHead className="text-right">Acciones</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePages.length ? (
                  visiblePages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell>
                        <div className="flex min-w-48 flex-col">
                          <span className="font-medium">{page.title}</span>
                          <span className="text-sm text-muted-foreground">
                            /b/{page.slug}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>
                            {page.views} vistas · {page.clicks} clics
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {page.views
                              ? `${((page.clicks / page.views) * 100).toFixed(1)}% de conversión`
                              : "Sin visitas todavía"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            page.status === "published" ? "success" : "neutral"
                          }
                        >
                          {page.status === "published"
                            ? "Publicada"
                            : "Borrador"}
                        </Badge>
                      </TableCell>
                      {data.canManage ? (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-label={`Abrir acciones para ${page.title}`}
                                className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                                size="icon-sm"
                                variant="brand-secondary"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" size="compact">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditing(page)
                                  setIsSheetOpen(true)
                                }}
                                size="compact"
                              >
                                <Pencil />
                                Editar
                              </DropdownMenuItem>
                              {page.status === "published" ? (
                                <DropdownMenuItem asChild size="compact">
                                  <a
                                    href={`/b/${page.slug}`}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    <ExternalLink />
                                    Ver publicada
                                  </a>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => setToDelete(page)}
                                size="compact"
                                variant="destructive"
                              >
                                <Trash2 />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    action={
                      hasFilters ? (
                        <Button onClick={clearFilters} variant="outline">
                          Limpiar filtros
                        </Button>
                      ) : null
                    }
                    colSpan={data.canManage ? 4 : 3}
                    description={
                      hasFilters
                        ? "Prueba con otro término o estado."
                        : "Crea una página para reunir todos tus enlaces en una sola dirección."
                    }
                    title={
                      hasFilters
                        ? "No hay coincidencias"
                        : "No hay páginas todavía"
                    }
                  />
                )}
              </TableBody>
            </Table>
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel="páginas"
              onNextPage={() =>
                setCurrentPage((current) => Math.min(current + 1, pageCount))
              }
              onPreviousPage={() =>
                setCurrentPage((current) => Math.max(current - 1, 1))
              }
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              total={filteredPages.length}
            />
          </CardContent>
        </Card>
        {data.canManage ? (
          <FloatingActionButton label="Nueva página" onClick={openCreate} />
        ) : null}
      </div>

      <PageSheet
        onOpenChange={setIsSheetOpen}
        onSubmit={save}
        open={isSheetOpen}
        page={editing}
        pending={pending}
      />

      <AlertDialog
        onOpenChange={(open) => !open && setToDelete(null)}
        open={Boolean(toDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{toDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              La dirección dejará de funcionar y se pierden sus métricas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                if (toDelete) void remove(toDelete)
              }}
              variant="destructive"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
