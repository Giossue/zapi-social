"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  CircleCheck,
  CircleDot,
  CircleX,
  LifeBuoy,
  MessageSquare,
  ShieldX,
  Timer,
  X,
} from "lucide-react"

import { adminSupportApi, ApiError } from "@workspace/api-client"
import type {
  AdminSupportCategory,
  AdminSupportMetrics,
  AdminSupportTicket,
  AdminSupportTicketStatus,
} from "@workspace/contracts"
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
import { EmptyState } from "@workspace/ui/components/empty-state"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
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
import { loginPath } from "@/features/identity/login-redirect"

const statusLabel: Record<AdminSupportTicketStatus, string> = {
  open: "Abierto",
  resolved: "Resuelto",
  closed: "Cerrado",
}

const statusVariant: Record<
  AdminSupportTicketStatus,
  "info" | "success" | "secondary"
> = { open: "info", resolved: "success", closed: "secondary" }

const emptyMetrics: AdminSupportMetrics = {
  open: 0,
  awaitingReply: 0,
  resolved: 0,
  closed: 0,
}

const pageSize = 10

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function SupportMetrics({ metrics }: { metrics: AdminSupportMetrics }) {
  const items = [
    {
      description: "Casos en curso",
      icon: CircleDot,
      label: "Abiertos",
      value: metrics.open,
    },
    {
      description: "Esperan respuesta del equipo",
      icon: Timer,
      label: "Sin responder",
      value: metrics.awaitingReply,
    },
    {
      description: "Atendidos en el historial",
      icon: CircleCheck,
      label: "Resueltos",
      value: metrics.resolved,
    },
    {
      description: "Sin acciones pendientes",
      icon: CircleX,
      label: "Cerrados",
      value: metrics.closed,
    },
  ]

  return (
    <CardGrid>
      {items.map((item) => (
        <MetricCard key={item.label} {...item} />
      ))}
    </CardGrid>
  )
}

export function AdminSupportPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([])
  const [categories, setCategories] = useState<AdminSupportCategory[]>([])
  const [metrics, setMetrics] = useState<AdminSupportMetrics>(emptyMetrics)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<AdminSupportTicketStatus | "all">("all")
  const [categoryId, setCategoryId] = useState("all")
  const [queue, setQueue] = useState<"all" | "awaiting">("all")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const response = await adminSupportApi.list({
        limit: pageSize,
        page,
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(status === "all" ? {} : { status }),
        ...(categoryId === "all" ? {} : { categoryId }),
        ...(queue === "awaiting" ? { awaitingReply: true } : {}),
      })
      setTickets(response.tickets)
      setCategories(response.categories)
      setMetrics(response.metrics)
      setTotal(response.total)
      setForbidden(false)
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error("Admin support request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [categoryId, page, query, queue, router, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = total ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = total ? rangeStart + tickets.length - 1 : 0
  const hasFilters = Boolean(
    query || status !== "all" || categoryId !== "all" || queue !== "all"
  )

  function clearFilters() {
    setQuery("")
    setStatus("all")
    setCategoryId("all")
    setQueue("all")
    setPage(1)
  }

  if (forbidden) {
    return (
      <EmptyState
        description="Tu cuenta no tiene permisos para administrar el soporte de la plataforma."
        icon={ShieldX}
        title="Acceso restringido"
      />
    )
  }

  if (isLoading && !tickets.length && !loadError) {
    return <PageLoading aria-label="Cargando casos de soporte" />
  }

  if (loadError) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description="No fue posible cargar los casos de soporte."
        icon={LifeBuoy}
        title="No pudimos cargar esta sección"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description="Cola de casos de todos los espacios de trabajo, con su estado y su última actividad."
        title="Soporte"
      />
      <SupportMetrics metrics={metrics} />
      <Card variant="subtle">
        <DataTableHeader
          search={{
            ariaLabel: "Buscar casos de soporte",
            onChange: (value) => {
              setQuery(value)
              setPage(1)
            },
            placeholder: "Buscar por asunto, cliente o espacio...",
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
              ariaLabel="Filtrar por cola"
              label="Cola"
              onValueChange={(value) => {
                setQueue(value as "all" | "awaiting")
                setPage(1)
              }}
              options={[
                { label: "Todos", value: "all" },
                { label: "Sin responder", value: "awaiting" },
              ]}
              value={queue}
            />
            <DataTableFilter
              ariaLabel="Filtrar por estado"
              label="Estado"
              onValueChange={(value) => {
                setStatus(value as AdminSupportTicketStatus | "all")
                setPage(1)
              }}
              options={[
                { label: "Todos", value: "all" },
                { label: "Abiertos", value: "open" },
                { label: "Resueltos", value: "resolved" },
                { label: "Cerrados", value: "closed" },
              ]}
              value={status}
            />
            <DataTableFilter
              ariaLabel="Filtrar por categoría"
              label="Categoría"
              onValueChange={(value) => {
                setCategoryId(value)
                setPage(1)
              }}
              options={[
                { label: "Todas", value: "all" },
                ...categories.map((category) => ({
                  label: category.name,
                  value: category.id,
                })),
              ]}
              value={categoryId}
            />
          </DataTableToolbar>
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caso</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Espacio
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Categoría
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Actividad
                  </TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length ? (
                  tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <div className="flex min-w-48 flex-col gap-1">
                          <span className="font-medium">{ticket.subject}</span>
                          <span className="text-sm text-muted-foreground">
                            {ticket.requester.displayName} ·{" "}
                            {ticket.requester.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {ticket.workspace.name}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {ticket.category.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={statusVariant[ticket.status]}>
                            {statusLabel[ticket.status]}
                          </Badge>
                          {ticket.awaitingReply ? (
                            <Badge variant="warning">Sin responder</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {formatDate(ticket.lastActivityAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="brand-secondary">
                          <Link href={`/admin/support/${ticket.id}`}>
                            <MessageSquare data-icon="inline-start" /> Ver caso
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    action={
                      hasFilters ? (
                        <Button onClick={clearFilters} variant="outline">
                          Restablecer filtros
                        </Button>
                      ) : null
                    }
                    colSpan={6}
                    description={
                      hasFilters
                        ? "Prueba con otro término, estado o categoría."
                        : "Cuando un cliente abra un caso aparecerá en esta cola."
                    }
                    title={
                      hasFilters
                        ? "No hay coincidencias"
                        : "Todavía no hay casos de soporte"
                    }
                  />
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            canGoNext={safePage < pageCount}
            canGoPrevious={safePage > 1}
            itemLabel="casos"
            onNextPage={() =>
              setPage((current) => Math.min(current + 1, pageCount))
            }
            onPreviousPage={() => setPage((current) => Math.max(current - 1, 1))}
            rangeEnd={rangeEnd}
            rangeStart={rangeStart}
            total={total}
          />
        </CardContent>
      </Card>
    </div>
  )
}
