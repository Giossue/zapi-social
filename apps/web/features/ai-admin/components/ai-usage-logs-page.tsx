"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleAlert, ShieldCheck, X } from "lucide-react"

import { ApiError, adminAiApi } from "@workspace/api-client"
import type { AdminAiRequestsResponse } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
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

type RequestLog = AdminAiRequestsResponse["requests"][number]

const pageSize = 25

const kindLabels: Record<RequestLog["kind"], string> = {
  content: "Crear contenido",
  image: "Crear imagen",
  video: "Crear video",
  repurpose: "Reutilizar contenido",
  planner: "Planificador",
  review: "Revisión",
  timing: "Mejor horario",
  search: "Búsqueda inteligente",
  ai_publishing: "Publicación AI",
}

const statusLabels: Record<RequestLog["status"], string> = {
  queued: "En cola",
  processing: "Procesando",
  succeeded: "Correcta",
  failed: "Fallida",
  cancelled: "Cancelada",
}

const statusVariants: Record<
  RequestLog["status"],
  "info" | "warning" | "success" | "destructive" | "neutral"
> = {
  queued: "info",
  processing: "warning",
  succeeded: "success",
  failed: "destructive",
  cancelled: "neutral",
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function money(microusd: number) {
  return new Intl.NumberFormat("es-EC", {
    currency: "USD",
    maximumFractionDigits: 4,
    style: "currency",
  }).format(microusd / 1_000_000)
}

export function AiUsageLogsPage() {
  const router = useRouter()
  const [data, setData] = useState<AdminAiRequestsResponse | null>(null)
  const [query, setQuery] = useState("")
  const [provider, setProvider] = useState("all")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setData(
        await adminAiApi.requests({
          limit: pageSize,
          page,
          ...(query.trim() ? { q: query.trim() } : {}),
          ...(provider === "all" ? {} : { provider }),
          ...(status === "all"
            ? {}
            : { status: status as RequestLog["status"] }),
        })
      )
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
      console.error("AI usage logs request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [page, provider, query, router, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description="Solicita a un administrador el permiso necesario para revisar el consumo de IA."
            icon={ShieldCheck}
            title="Registro no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !data && !loadError) {
    return <PageLoading aria-label="Cargando registro de IA" />
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
            description="No pudimos cargar el registro de peticiones de IA."
            icon={CircleAlert}
            title="Registro no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  const pageCount = Math.max(1, Math.ceil(data.total / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = data.total ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = data.total ? rangeStart + data.requests.length - 1 : 0
  const hasFilters = Boolean(query || provider !== "all" || status !== "all")

  function clearFilters() {
    setQuery("")
    setProvider("all")
    setStatus("all")
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description="Cada generación de IA con su origen, proveedor, consumo y resultado."
        title="Registro de uso de IA"
      />
      <Card variant="subtle">
        <DataTableHeader
          search={{
            ariaLabel: "Buscar por usuario o espacio de trabajo",
            onChange: (value) => {
              setQuery(value)
              setPage(1)
            },
            placeholder: "Buscar por usuario o espacio...",
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
              ariaLabel="Filtrar por proveedor"
              label="Proveedor"
              onValueChange={(value) => {
                setProvider(value)
                setPage(1)
              }}
              options={[
                { label: "Todos", value: "all" },
                ...data.providers.map((item) => ({
                  label: item,
                  value: item,
                })),
              ]}
              value={provider}
            />
            <DataTableFilter
              ariaLabel="Filtrar por estado"
              label="Estado"
              onValueChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
              options={[
                { label: "Todos", value: "all" },
                { label: "Correctas", value: "succeeded" },
                { label: "Fallidas", value: "failed" },
                { label: "En cola", value: "queued" },
                { label: "Procesando", value: "processing" },
                { label: "Canceladas", value: "cancelled" },
              ]}
              value={status}
            />
          </DataTableToolbar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Solicitud</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead className="hidden lg:table-cell">Modelo</TableHead>
                <TableHead>Consumo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.requests.length ? (
                data.requests.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex min-w-40 flex-col">
                        <span className="font-medium">
                          {kindLabels[item.kind]}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-40 flex-col">
                        <span>{item.userName}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.workspaceName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-col">
                        <span>{item.model ?? "—"}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.provider ?? "interno"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>
                          {item.inputTokens + item.outputTokens} tokens
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {money(item.estimatedCostMicrousd)}
                          {item.latencyMs ? ` · ${item.latencyMs} ms` : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={statusVariants[item.status]}>
                          {statusLabels[item.status]}
                        </Badge>
                        {item.errorCode ? (
                          <span className="font-mono text-xs text-destructive">
                            {item.errorCode}
                          </span>
                        ) : null}
                      </div>
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
                    ) : undefined
                  }
                  colSpan={5}
                  description={
                    hasFilters
                      ? "Prueba con otro término, proveedor o estado."
                      : "Aquí aparecerá cada generación en cuanto se registre."
                  }
                  title={
                    hasFilters
                      ? "No hay coincidencias"
                      : "Aún no hay generaciones"
                  }
                />
              )}
            </TableBody>
          </Table>
          <TablePagination
            canGoNext={safePage < pageCount}
            canGoPrevious={safePage > 1}
            itemLabel="generaciones"
            onNextPage={() =>
              setPage((current) => Math.min(current + 1, pageCount))
            }
            onPreviousPage={() =>
              setPage((current) => Math.max(current - 1, 1))
            }
            rangeEnd={rangeEnd}
            rangeStart={rangeStart}
            total={data.total}
          />
        </CardContent>
      </Card>
    </div>
  )
}
