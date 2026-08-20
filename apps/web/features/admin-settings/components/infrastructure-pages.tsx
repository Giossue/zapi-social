"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleAlert, Clock, Database, ShieldCheck, Trash2 } from "lucide-react"

import { ApiError, adminSettingsApi } from "@workspace/api-client"
import type { AdminCacheState, AdminScheduledJobs } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { MetricCard } from "@workspace/ui/components/metric-card"
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
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { toast } from "@workspace/ui/components/toast"

function formatDateTime(value: string | null) {
  if (!value) return "Nunca"
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function useAdminResource<T>(load: () => Promise<T>, label: string) {
  const router = useRouter()
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  /** El consumidor pasa una función nueva por render; no puede ser dependencia. */
  const loadRef = useRef(load)
  loadRef.current = load

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setData(await loadRef.current())
      setForbidden(false)
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace("/login")
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error(`${label} request failed`, error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [label, router])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, forbidden, isLoading, loadError, refresh, setData }
}

function StateGuard({
  children,
  forbidden,
  isLoading,
  loadError,
  onRetry,
  ready,
  title,
}: {
  children: React.ReactNode
  forbidden: boolean
  isLoading: boolean
  loadError: boolean
  onRetry: () => void
  ready: boolean
  title: string
}) {
  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description="Solicita a un administrador el permiso necesario para ver esta información."
            icon={ShieldCheck}
            title={`${title} no disponible`}
          />
        </CardContent>
      </Card>
    )
  }
  if (isLoading && !ready) {
    return <PageLoading aria-label={`Cargando ${title.toLowerCase()}`} />
  }
  if (loadError || !ready) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={<RetryButton onClick={onRetry} variant="brand-secondary" />}
            description="No pudimos consultar el estado de la infraestructura."
            icon={CircleAlert}
            title={`${title} no disponible`}
          />
        </CardContent>
      </Card>
    )
  }
  return <>{children}</>
}

export function CacheSettingsPage() {
  const { data, forbidden, isLoading, loadError, refresh, setData } =
    useAdminResource<AdminCacheState>(() => adminSettingsApi.cache(), "Caché")
  const [pending, setPending] = useState(false)

  async function purge() {
    setPending(true)
    try {
      const result = await adminSettingsApi.purgeCache()
      toast.success(
        result.removed
          ? `Se vaciaron ${result.removed} claves de caché.`
          : "No había claves de caché que vaciar."
      )
      setData(await adminSettingsApi.cache())
    } catch (error) {
      console.error("Cache purge failed", error)
      toast.error("No pudimos vaciar la caché. Inténtalo de nuevo.")
    } finally {
      setPending(false)
    }
  }

  return (
    <StateGuard
      forbidden={forbidden}
      isLoading={isLoading}
      loadError={loadError}
      onRetry={() => void refresh()}
      ready={Boolean(data)}
      title="Caché"
    >
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description="Estado de Redis y vaciado de la caché de aplicación."
          title="Caché"
        />
        <CardGrid layout="md-3">
          <MetricCard
            description="Claves almacenadas ahora"
            icon={Database}
            label="Claves"
            value={data?.keys ?? 0}
          />
          <MetricCard
            description="Memoria usada por Redis"
            icon={Database}
            label="Memoria"
            value={data?.memoryUsed ?? "—"}
          />
          <MetricCard
            description="Última limpieza registrada"
            icon={Clock}
            label="Último vaciado"
            value={formatDateTime(data?.lastPurgedAt ?? null)}
          />
        </CardGrid>
        <Card variant="subtle">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium">Vaciar caché de aplicación</p>
              <p className="text-sm text-muted-foreground">
                Borra solo las claves con prefijo <code>cache:</code>. Las colas
                de trabajos y sus jobs pendientes no se tocan.
              </p>
            </div>
            <Button
              disabled={pending || !data?.reachable}
              onClick={() => void purge()}
              variant="destructive"
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              Vaciar caché
            </Button>
          </CardContent>
        </Card>
      </div>
    </StateGuard>
  )
}

export function CronsSettingsPage() {
  const { data, forbidden, isLoading, loadError, refresh } =
    useAdminResource<AdminScheduledJobs>(
      () => adminSettingsApi.scheduledJobs(),
      "Tareas programadas"
    )

  return (
    <StateGuard
      forbidden={forbidden}
      isLoading={isLoading}
      loadError={loadError}
      onRetry={() => void refresh()}
      ready={Boolean(data)}
      title="Tareas programadas"
    >
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description="Trabajos recurrentes del Worker y su cola en Redis."
          title="Tareas programadas"
        />
        <Card variant="subtle">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarea</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Frecuencia
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Próxima ejecución
                  </TableHead>
                  <TableHead>Cola</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.jobs.length ? (
                  data.jobs.map((job) => (
                    <TableRow key={job.queue}>
                      <TableCell>
                        <div className="flex min-w-40 flex-col">
                          <span className="font-medium">{job.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {job.queue}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {job.everyMinutes
                          ? `Cada ${job.everyMinutes} min`
                          : "Por demanda"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {formatDateTime(job.nextRunAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="neutral">
                            {job.waiting} en espera
                          </Badge>
                          {job.delayed ? (
                            <Badge variant="info">
                              {job.delayed} diferidos
                            </Badge>
                          ) : null}
                          {job.failed ? (
                            <Badge variant="destructive">
                              {job.failed} fallidos
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    colSpan={4}
                    description="El Worker no reporta trabajos recurrentes en Redis."
                    icon={Clock}
                    title="Sin tareas programadas"
                  />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </StateGuard>
  )
}
