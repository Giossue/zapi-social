"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, RefreshCw } from "lucide-react"
import { auditApi, ApiError } from "@workspace/api-client"
import type { AdminAuditEvent } from "@workspace/contracts"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@workspace/ui/components/table-pagination"

const sourceLabels = { web: "Web", api: "API", worker: "Worker" } as const
const severityVariant = {
  success: "success",
  warning: "warning",
  error: "destructive",
} as const
const PAGE_SIZE = 10

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function AuditEventsPage() {
  const [events, setEvents] = useState<AdminAuditEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [source, setSource] = useState("all")
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await auditApi.list()
      setEvents(response.events)
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? "No se pudo cargar la auditoría."
          : "No se pudo cargar la auditoría."
      )
      setEvents([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es")
    return (events ?? []).filter((item) => {
      const matchesSource = source === "all" || item.source === source
      const searchable = [
        item.event,
        item.summary,
        item.actorName,
        item.actorEmail,
        item.workspaceName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es")
      return matchesSource && (!needle || searchable.includes(needle))
    })
  }, [events, query, source])
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const rangeStart = filteredEvents.length
    ? (currentPage - 1) * PAGE_SIZE + 1
    : 0
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredEvents.length)
  const rows = filteredEvents.slice(rangeStart ? rangeStart - 1 : 0, rangeEnd)

  return (
    <section className="flex flex-col gap-4 py-4">
      {events === null ? (
        <PageLoading />
      ) : error ? (
        <Card variant="subtle">
          <EmptyState
            action={
              <RetryButton
                onClick={() => void load()}
                variant="brand-secondary"
              />
            }
            description={error}
            icon={Activity}
            title="Auditoría no disponible"
          />
        </Card>
      ) : (
        <Card variant="subtle">
          <DataTableHeader
            action={
              <Button
                disabled={refreshing}
                onClick={() => {
                  setRefreshing(true)
                  void load().finally(() => setRefreshing(false))
                }}
                size="sm"
                variant="brand-secondary"
              >
                {refreshing ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RefreshCw aria-hidden="true" data-icon="inline-start" />
                )}
                {refreshing ? "Actualizando..." : "Actualizar"}
              </Button>
            }
            description="Actividad registrada por Web, API y Worker."
            search={{
              ariaLabel: "Buscar eventos de auditoría",
              onChange: (value) => {
                setQuery(value)
                setPage(1)
              },
              placeholder: "Buscar eventos...",
              value: query,
            }}
            title="Auditoría"
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar>
              <DataTableFilter
                ariaLabel="Filtrar eventos por origen"
                label="Origen"
                onValueChange={(value) => {
                  setSource(value)
                  setPage(1)
                }}
                options={[
                  { label: "Todos los orígenes", value: "all" },
                  { label: "Web", value: "web" },
                  { label: "API", value: "api" },
                  { label: "Worker", value: "worker" },
                ]}
                value={source}
              />
            </DataTableToolbar>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Espacio</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={`${item.source}-${item.id}`}>
                    <TableCell
                      className="max-w-64 truncate font-medium"
                      title={item.summary ?? item.event}
                    >
                      {item.event}
                    </TableCell>
                    <TableCell>{sourceLabels[item.source]}</TableCell>
                    <TableCell>
                      <Badge variant={severityVariant[item.severity]}>
                        {item.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.actorName ?? item.actorEmail ?? "Sistema"}
                    </TableCell>
                    <TableCell>{item.workspaceName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="h-28 text-center text-muted-foreground"
                      colSpan={6}
                    >
                      {events.length === 0
                        ? "Aún no hay eventos registrados."
                        : "No hay eventos que coincidan con estos filtros."}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <TablePagination
              canGoNext={currentPage < pageCount}
              canGoPrevious={currentPage > 1}
              itemLabel="eventos"
              onNextPage={() =>
                setPage((current) => Math.min(current + 1, pageCount))
              }
              onPreviousPage={() =>
                setPage((current) => Math.max(current - 1, 1))
              }
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              total={filteredEvents.length}
            />
          </CardContent>
        </Card>
      )}
    </section>
  )
}
