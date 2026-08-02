"use client"

import { useMemo, useState } from "react"
import {
  CalendarClock,
  FilePenLine,
  ListFilter,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type {
  PublishingPost,
  PublishingProvider,
  PublishingStatus,
} from "@/features/publishing/types/publishing-calendar"

const PAGE_SIZE = 30

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

export function PublishingMetrics({
  items,
}: {
  items: Array<{ icon: typeof CalendarClock; label: string; value: number }>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ icon: Icon, label, value }) => (
        <Card key={label} variant="subtle">
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
            <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
      ))}
    </div>
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
  onDelete?: (post: PublishingPost) => void
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

  function clearFilters() {
    setQuery("")
    setProvider("all")
    setStatus("all")
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_11rem]">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Buscar publicaciones"
            className="pl-9"
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar por contenido o cuenta"
            value={query}
          />
        </div>
        <Select
          onValueChange={(value) => {
            setProvider(value as PublishingProvider | "all")
            setPage(1)
          }}
          value={provider}
        >
          <SelectTrigger aria-label="Filtrar por red">
            <SelectValue placeholder="Red" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las redes</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) => {
            setStatus(value as PublishingStatus | "all")
            setPage(1)
          }}
          value={status}
        >
          <SelectTrigger aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {mode === "drafts" ? (
              <SelectItem value="draft">Borrador</SelectItem>
            ) : (
              <>
                <SelectItem value="scheduled">Programada</SelectItem>
                <SelectItem value="processing">En proceso</SelectItem>
                <SelectItem value="failed">Fallida</SelectItem>
                <SelectItem value="published">Publicada</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>
      {hasFilters ? (
        <div className="flex justify-end">
          <Button onClick={clearFilters} size="sm" variant="ghost">
            <ListFilter data-icon="inline-start" />
            Limpiar filtros
          </Button>
        </div>
      ) : null}
      {pagePosts.length ? (
        <Card className="overflow-hidden" variant="surface">
          <CardContent className="overflow-x-auto px-0">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Publicación</th>
                  <th className="px-4 py-3 font-medium">Cuenta</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-6 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagePosts.map((post) => (
                  <tr
                    className="border-b border-border last:border-0"
                    key={post.id}
                  >
                    <td className="max-w-72 px-6 py-4">
                      <p className="truncate font-medium">{post.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {post.hasMedia ? "Con archivo" : "Solo texto"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p>{post.channel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {providerLabels[post.provider]}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {formatDate(post)} · {post.time}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={statusVariants[post.status]}>
                        {statusLabels[post.status]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        {mode === "drafts" && onContinue ? (
                          <Button
                            onClick={() => onContinue(post)}
                            size="sm"
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
                          <Button onClick={() => onRetry(post)} size="sm">
                            <RotateCcw data-icon="inline-start" />
                            Reintentar
                          </Button>
                        ) : null}
                        {mode === "drafts" && onDelete ? (
                          <Button
                            aria-label={`Eliminar ${post.title}`}
                            onClick={() => onDelete(post)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card variant="subtle">
          <CardContent>
            <EmptyState
              description={
                hasFilters
                  ? "Prueba otros filtros o limpia la búsqueda para ver las publicaciones disponibles."
                  : mode === "drafts"
                    ? "Guarda una publicación como borrador para continuarla después."
                    : "Cuando programes o publiques una pieza, su progreso aparecerá aquí por cada destino."
              }
              icon={mode === "drafts" ? FilePenLine : CalendarClock}
              title={
                hasFilters
                  ? "No encontramos publicaciones"
                  : mode === "drafts"
                    ? "Todavía no hay borradores"
                    : "La cola está vacía"
              }
            />
          </CardContent>
        </Card>
      )}
      {filteredPosts.length > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, filteredPosts.length)} de{" "}
            {filteredPosts.length}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={currentPage === 1}
              onClick={() => setPage((value) => value - 1)}
              size="sm"
              variant="brand-secondary"
            >
              Anterior
            </Button>
            <Button
              disabled={currentPage === pageCount}
              onClick={() => setPage((value) => value + 1)}
              size="sm"
              variant="brand-secondary"
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
