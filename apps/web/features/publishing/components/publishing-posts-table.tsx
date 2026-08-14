"use client"

import { type MouseEvent, useMemo, useState } from "react"
import {
  CalendarClock,
  FilePenLine,
  Image,
  ListFilter,
  RotateCcw,
  Trash2,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { Card, CardContent } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { MetricCard } from "@workspace/ui/components/metric-card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  TABLE_EMPTY_ICON,
  TableEmptyRow,
} from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { Spinner } from "@workspace/ui/components/spinner"
import type {
  PublishingPost,
  PublishingProvider,
  PublishingStatus,
} from "@/features/publishing/types/publishing-calendar"

const PAGE_SIZE = 10

const providerLabels: Record<PublishingProvider, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
}

const statusLabels: Record<PublishingStatus, string> = {
  draft: "Borrador",
  failed: "Fallida",
  processing: "En proceso",
  published: "Publicada",
  scheduled: "Programada",
}

const statusVariants: Record<
  PublishingStatus,
  "neutral" | "success" | "warning" | "destructive"
> = {
  draft: "neutral",
  failed: "destructive",
  processing: "warning",
  published: "success",
  scheduled: "neutral",
}

function formatDate(post: PublishingPost) {
  return new Date(`${post.date}T12:00:00`).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  })
}

function PostActions({
  mode,
  onContinue,
  onDelete,
  onRetry,
  post,
}: {
  mode: "drafts" | "queue"
  onContinue?: (post: PublishingPost) => void
  onDelete?: (post: PublishingPost) => boolean | void | Promise<boolean | void>
  onRetry?: (post: PublishingPost) => void
  post: PublishingPost
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)

  async function confirmDelete(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (!onDelete || deletePending) return

    setDeletePending(true)
    try {
      const deleted = await onDelete(post)
      if (deleted !== false) setDeleteOpen(false)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === "drafts" && onContinue ? (
        <Button
          onClick={() => onContinue(post)}
          size="sm"
          type="button"
          variant="brand-secondary"
        >
          <FilePenLine data-icon="inline-start" />
          Editar
        </Button>
      ) : null}
      {mode === "queue" &&
      post.status === "failed" &&
      post.recoverable &&
      onRetry ? (
        <Button onClick={() => onRetry(post)} size="sm" type="button">
          <RotateCcw data-icon="inline-start" />
          Reintentar
        </Button>
      ) : null}
      {mode === "drafts" && onDelete ? (
        <AlertDialog
          onOpenChange={(nextOpen) => !deletePending && setDeleteOpen(nextOpen)}
          open={deleteOpen}
        >
          <AlertDialogTrigger asChild>
            <Button
              aria-label={`Eliminar ${post.title}`}
              size="icon-sm"
              type="button"
              variant="brand-secondary"
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
              <AlertDialogDescription>
                El borrador “{post.title}” se eliminará definitivamente. Esta
                acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={deletePending}
                variant="brand-secondary"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deletePending}
                onClick={confirmDelete}
                type="button"
                variant="destructive"
              >
                {deletePending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Trash2 data-icon="inline-start" />
                )}
                {deletePending ? "Eliminando..." : "Eliminar borrador"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  )
}

function PostCard({
  mode,
  onContinue,
  onDelete,
  onRetry,
  post,
}: {
  mode: "drafts" | "queue"
  onContinue?: (post: PublishingPost) => void
  onDelete?: (post: PublishingPost) => boolean | void | Promise<boolean | void>
  onRetry?: (post: PublishingPost) => void
  post: PublishingPost
}) {
  return (
    <Card size="sm" variant="surface">
      <CardContent>
        <Item size="sm" variant="outline">
          <ItemMedia variant="icon">
            <Image aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{post.title}</ItemTitle>
            <ItemDescription>
              {post.channel} · {formatDate(post)} · {post.time}
            </ItemDescription>
          </ItemContent>
          <Badge variant={statusVariants[post.status]}>
            {statusLabels[post.status]}
          </Badge>
          <ItemActions className="basis-full justify-between sm:basis-auto sm:justify-end">
            <span className="text-xs text-muted-foreground">
              {post.hasMedia ? "Con archivo" : "Solo texto"}
            </span>
            <PostActions
              mode={mode}
              onContinue={onContinue}
              onDelete={onDelete}
              onRetry={onRetry}
              post={post}
            />
          </ItemActions>
        </Item>
      </CardContent>
    </Card>
  )
}

export function PublishingMetrics({
  items,
}: {
  items: Array<{
    description: string
    icon: typeof CalendarClock
    label: string
    value: number
  }>
}) {
  return (
    <CardGrid layout="xl-3">
      {items.map((item) => (
        <MetricCard key={item.label} {...item} />
      ))}
    </CardGrid>
  )
}

export function PublishingPostsTable({
  mode,
  onContinue,
  onDelete,
  onRetry,
  posts,
}: {
  mode: "drafts" | "queue"
  onContinue?: (post: PublishingPost) => void
  onDelete?: (post: PublishingPost) => boolean | void | Promise<boolean | void>
  onRetry?: (post: PublishingPost) => void
  posts: PublishingPost[]
}) {
  const [query, setQuery] = useState("")
  const [provider, setProvider] = useState<PublishingProvider | "all">("all")
  const [status, setStatus] = useState<PublishingStatus | "all">("all")
  const [page, setPage] = useState(1)
  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es")
    return posts.filter((post) => {
      const matchesQuery =
        !normalized ||
        `${post.title} ${post.channel}`
          .toLocaleLowerCase("es")
          .includes(normalized)
      return (
        matchesQuery &&
        (provider === "all" || post.provider === provider) &&
        (status === "all" || post.status === status)
      )
    })
  }, [posts, provider, query, status])
  const pageCount = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagePosts = filteredPosts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )
  const hasFilters = query || provider !== "all" || status !== "all"
  const emptyProps = {
    description: hasFilters
      ? "Prueba otros filtros o limpia la búsqueda para ver las publicaciones disponibles."
      : mode === "drafts"
        ? "Guarda una publicación como borrador para continuarla después."
        : "Cuando programes o publiques una pieza, su progreso aparecerá aquí por cada destino.",
    icon: TABLE_EMPTY_ICON,
    title: hasFilters
      ? "No encontramos publicaciones"
      : mode === "drafts"
        ? "Todavía no hay borradores"
        : "La cola está vacía",
  }
  const pageRangeStart = filteredPosts.length
    ? (currentPage - 1) * PAGE_SIZE + 1
    : 0
  const pageRangeEnd = Math.min(currentPage * PAGE_SIZE, filteredPosts.length)
  const tableTitle = mode === "drafts" ? "Borradores" : "Cola de publicación"
  const tableDescription =
    mode === "drafts"
      ? "Continúa, filtra o elimina las publicaciones guardadas para después."
      : "Supervisa las publicaciones programadas, en proceso y fallidas por destino."

  function clearFilters() {
    setQuery("")
    setProvider("all")
    setStatus("all")
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description={tableDescription}
        level="h2"
        title={tableTitle}
      />
      <Card variant="subtle">
        <DataTableHeader
          search={{
            ariaLabel: "Buscar publicaciones",
            onChange: (value) => {
              setQuery(value)
              setPage(1)
            },
            placeholder: "Buscar publicaciones",
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
                  variant="brand-secondary"
                >
                  <ListFilter data-icon="inline-start" />
                  Limpiar
                </Button>
              ) : undefined
            }
          >
            <DataTableFilter
              ariaLabel="Filtrar por red"
              label="Red"
              onValueChange={(value) => {
                setProvider(value as PublishingProvider | "all")
                setPage(1)
              }}
              options={[
                { label: "Todas las redes", value: "all" },
                { label: "Facebook", value: "facebook" },
                { label: "Instagram", value: "instagram" },
                { label: "WhatsApp", value: "whatsapp" },
              ]}
              value={provider}
            />
            <DataTableFilter
              ariaLabel="Filtrar por estado"
              label="Estado"
              onValueChange={(value) => {
                setStatus(value as PublishingStatus | "all")
                setPage(1)
              }}
              options={
                mode === "drafts"
                  ? [
                      { label: "Todos los estados", value: "all" },
                      { label: "Borrador", value: "draft" },
                    ]
                  : [
                      { label: "Todos los estados", value: "all" },
                      { label: "Programada", value: "scheduled" },
                      { label: "En proceso", value: "processing" },
                      { label: "Fallida", value: "failed" },
                      { label: "Publicada", value: "published" },
                    ]
              }
              value={status}
            />
          </DataTableToolbar>

          <>
            <div className="hidden overflow-hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Publicación</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="pr-4 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagePosts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="max-w-72 pl-4">
                        <p className="truncate font-medium">{post.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {post.hasMedia ? "Con archivo" : "Solo texto"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-48 truncate">{post.channel}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {providerLabels[post.provider]}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(post)} · {post.time}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[post.status]}>
                          {statusLabels[post.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="inline-flex">
                          <PostActions
                            mode={mode}
                            onContinue={onContinue}
                            onDelete={onDelete}
                            onRetry={onRetry}
                            post={post}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pagePosts.length === 0 ? (
                    <TableEmptyRow colSpan={5} {...emptyProps} />
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-3 px-4 md:hidden">
              {pagePosts.length === 0 ? <EmptyState {...emptyProps} /> : null}
              {pagePosts.map((post) => (
                <PostCard
                  key={post.id}
                  mode={mode}
                  onContinue={onContinue}
                  onDelete={onDelete}
                  onRetry={onRetry}
                  post={post}
                />
              ))}
            </div>
            <TablePagination
              canGoNext={currentPage < pageCount}
              canGoPrevious={currentPage > 1}
              itemLabel="publicaciones"
              onNextPage={() => setPage((value) => value + 1)}
              onPreviousPage={() => setPage((value) => value - 1)}
              rangeEnd={pageRangeEnd}
              rangeStart={pageRangeStart}
              total={filteredPosts.length}
            />
          </>
        </CardContent>
      </Card>
    </div>
  )
}
