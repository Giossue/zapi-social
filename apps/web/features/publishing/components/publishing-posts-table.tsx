"use client"

import { useMemo, useState } from "react"
import {
  CalendarClock,
  FilePenLine,
  Image,
  ListFilter,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
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

function PostActions({
  mode,
  onContinue,
  onDelete,
  onRetry,
  post,
}: {
  mode: "drafts" | "queue"
  onContinue?: (post: PublishingPost) => void
  onDelete?: (post: PublishingPost) => void
  onRetry?: (post: PublishingPost) => void
  post: PublishingPost
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
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
          size="icon-sm"
          variant="brand-secondary"
        >
          <Trash2 />
        </Button>
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
  onDelete?: (post: PublishingPost) => void
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
  items: Array<{ icon: typeof CalendarClock; label: string; value: number }>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ icon: Icon, label, value }) => (
        <Card key={label} size="sm" variant="subtle">
          <CardContent className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-xl font-semibold tracking-tight">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
            <Icon aria-hidden="true" className="text-muted-foreground" />
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
    <div className="flex flex-col gap-4">
      <Card size="sm" variant="surface">
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <InputGroup className="lg:flex-1">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Buscar publicaciones"
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Buscar por contenido o cuenta"
              value={query}
            />
          </InputGroup>
          <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-center">
            <Select
              onValueChange={(value) => {
                setProvider(value as PublishingProvider | "all")
                setPage(1)
              }}
              value={provider}
            >
              <SelectTrigger
                aria-label="Filtrar por red"
                className="w-full lg:w-40"
              >
                <SelectValue placeholder="Red" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todas las redes</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) => {
                setStatus(value as PublishingStatus | "all")
                setPage(1)
              }}
              value={status}
            >
              <SelectTrigger
                aria-label="Filtrar por estado"
                className="w-full lg:w-40"
              >
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
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
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {hasFilters ? (
            <Button onClick={clearFilters} size="sm" variant="brand-secondary">
              <ListFilter data-icon="inline-start" />
              Limpiar filtros
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {pagePosts.length ? (
        <>
          <Card
            className="hidden overflow-hidden md:block"
            size="sm"
            variant="surface"
          >
            <CardContent className="px-0">
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
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-3 md:hidden">
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
        </>
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
