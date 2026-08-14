"use client"

import { useDeferredValue, useEffect, useState } from "react"

import {
  ExternalLink,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Rss,
  Trash2,
} from "lucide-react"

import {
  ApiError,
  profileApi,
  publishingApi,
  rssSchedulesApi,
} from "@workspace/api-client"
import type {
  PortalRssSchedule,
  PortalRssSchedulesResponse,
  PortalRssScheduleWeekday,
} from "@workspace/contracts"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { PageLoading } from "@workspace/ui/components/page-loading"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { toast } from "@workspace/ui/components/toast"

import type {
  RssSchedule,
  RssScheduleStatus,
} from "@/features/rss-schedules/types/rss-schedules"

import {
  RssScheduleWizard,
  type RssScheduleTargetAccount,
  type RssScheduleWizardInput,
} from "./rss-schedule-wizard"
import {
  RssSchedulesErrorState,
  RssSchedulesPermissionState,
} from "./rss-schedules-states"

const pageSize = 10

const statusLabel: Record<RssScheduleStatus, string> = {
  active: "Activa",
  paused: "En pausa",
}

const providerLabel = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
} as const

const weekdaysByFrequency: Record<
  RssScheduleWizardInput["frequency"],
  PortalRssScheduleWeekday[]
> = {
  daily: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  weekdays: ["mon", "tue", "wed", "thu", "fri"],
  weekly: ["mon"],
}

type ListLoadState =
  | { status: "loading" }
  | { status: "error" }
  | { data: PortalRssSchedulesResponse; status: "ready" }

type SetupLoadState =
  | { status: "loading" }
  | { status: "error" }
  | {
      accounts: RssScheduleTargetAccount[]
      timezone: string
      status: "ready"
    }

function destinationsSummary(targets: readonly string[]) {
  const [firstTarget, ...remainingTargets] = targets

  if (!firstTarget) return { primary: "Sin destinos", secondary: "" }

  return {
    primary: firstTarget,
    secondary: remainingTargets.length
      ? `+${remainingTargets.length} destino${remainingTargets.length === 1 ? "" : "s"}`
      : "1 canal conectado",
  }
}

function dateTimeLabel(value: string | null, fallback: string) {
  if (!value) return fallback

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return fallback

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function toRssScheduleRow(schedule: PortalRssSchedule): RssSchedule {
  return {
    feedUrl: schedule.feedUrl,
    id: schedule.id,
    lastRun: dateTimeLabel(
      schedule.lastQueuedAt ?? schedule.lastCheckedAt,
      "Aún no se ejecuta"
    ),
    name: schedule.name,
    nextRun: dateTimeLabel(
      schedule.nextRunAt,
      schedule.status === "paused"
        ? "En pausa"
        : "Pendiente de la primera ejecución"
    ),
    queued: schedule.queuedCount,
    status: schedule.status,
    targets: schedule.targets.map((target) => target.displayName),
  }
}

function setupTargetAccounts(
  accounts: Awaited<ReturnType<typeof publishingApi.list>>["accounts"]
) {
  return accounts
    .filter((account) => account.connected)
    .map((account) => ({
      description: "Conectada",
      id: account.id,
      label: `${providerLabel[account.provider]} · ${account.name}`,
    }))
}

function clientTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.code === "VALIDATION_FAILED")
    return "Revisa las cuentas y los datos de la programación."
  return fallback
}

export function RssSchedulesPage() {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [status, setStatus] = useState<"all" | RssScheduleStatus>("all")
  const [page, setPage] = useState(1)
  const [reloadToken, setReloadToken] = useState(0)
  const [setupReloadToken, setSetupReloadToken] = useState(0)
  const [listState, setListState] = useState<ListLoadState>({
    status: "loading",
  })
  const [setupState, setSetupState] = useState<SetupLoadState>({
    status: "loading",
  })

  useEffect(() => {
    let isCurrent = true

    void Promise.all([publishingApi.list(), profileApi.get()])
      .then(([publishing, profile]) => {
        if (!isCurrent) return
        setSetupState({
          accounts: setupTargetAccounts(publishing.accounts),
          status: "ready",
          timezone: profile.timezone ?? clientTimezone(),
        })
      })
      .catch(() => {
        if (isCurrent) setSetupState({ status: "error" })
      })

    return () => {
      isCurrent = false
    }
  }, [setupReloadToken])

  useEffect(() => {
    let isCurrent = true
    const trimmedQuery = deferredQuery.trim()

    setListState({ status: "loading" })
    void rssSchedulesApi
      .list({
        limit: pageSize,
        page,
        ...(trimmedQuery ? { q: trimmedQuery } : {}),
        ...(status === "all" ? {} : { status }),
      })
      .then((data) => {
        if (isCurrent) setListState({ data, status: "ready" })
      })
      .catch(() => {
        if (isCurrent) setListState({ status: "error" })
      })

    return () => {
      isCurrent = false
    }
  }, [deferredQuery, page, reloadToken, status])

  function refresh() {
    setReloadToken((current) => current + 1)
  }

  function retry() {
    refresh()
    setSetupReloadToken((current) => current + 1)
  }

  function changeQuery(value: string) {
    setPage(1)
    setQuery(value)
  }

  function changeStatus(value: "all" | RssScheduleStatus) {
    setPage(1)
    setStatus(value)
  }

  if (listState.status === "loading" || setupState.status === "loading")
    return <PageLoading />
  if (listState.status === "error" || setupState.status === "error")
    return <RssSchedulesErrorState onRetry={retry} />
  if (!listState.data.canView) return <RssSchedulesPermissionState />

  return (
    <RssSchedules
      accounts={setupState.accounts}
      canManage={listState.data.canManage}
      initialRows={listState.data.schedules.map(toRssScheduleRow)}
      onPageChange={setPage}
      onQueryChange={changeQuery}
      onRefresh={refresh}
      onStatusChange={changeStatus}
      page={listState.data.page}
      query={query}
      status={status}
      timezone={setupState.timezone}
      total={listState.data.total}
    />
  )
}

function RssSchedules({
  accounts,
  canManage,
  initialRows,
  onPageChange,
  onQueryChange,
  onRefresh,
  onStatusChange,
  page,
  query,
  status,
  timezone,
  total,
}: {
  accounts: readonly RssScheduleTargetAccount[]
  canManage: boolean
  initialRows: readonly RssSchedule[]
  onPageChange: (page: number) => void
  onQueryChange: (value: string) => void
  onRefresh: () => void
  onStatusChange: (value: "all" | RssScheduleStatus) => void
  page: number
  query: string
  status: "all" | RssScheduleStatus
  timezone: string
  total: number
}) {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const visibleRows = initialRows
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  async function addSchedule(input: RssScheduleWizardInput) {
    await rssSchedulesApi.create({
      contentRules: input.contentRules,
      description: "",
      feedUrl: input.feedUrl,
      name: input.name,
      status: "active",
      targetSocialAccountIds: input.targetSocialAccountIds,
      timeSlots: [input.preferredTime],
      timezone,
      weekdays: weekdaysByFrequency[input.frequency],
    })
    toast.success("La programación RSS se creó.")
    onRefresh()
  }

  async function validateFeed(feedUrl: string) {
    await rssSchedulesApi.validateFeed({ feedUrl })
  }

  async function toggle(id: string) {
    setPendingId(id)
    try {
      const schedule = await rssSchedulesApi.toggle(id)
      toast.success(
        schedule.status === "active"
          ? "La programación se reactivó."
          : "La programación quedó en pausa."
      )
      onRefresh()
    } catch (error) {
      toast.error(
        apiErrorMessage(error, "No pudimos actualizar la programación.")
      )
    } finally {
      setPendingId(null)
    }
  }

  async function remove(id: string) {
    setPendingId(id)
    try {
      await rssSchedulesApi.remove(id)
      toast.success("La programación RSS se eliminó.")
      onRefresh()
    } catch (error) {
      toast.error(
        apiErrorMessage(error, "No pudimos eliminar la programación.")
      )
    } finally {
      setPendingId(null)
    }
  }

  async function runNow(id: string) {
    setPendingId(id)
    try {
      await rssSchedulesApi.run(id)
      toast.success("La ejecución se añadió a la cola.")
      onRefresh()
    } catch (error) {
      toast.error(apiErrorMessage(error, "No pudimos iniciar la ejecución."))
    } finally {
      setPendingId(null)
    }
  }

  function resetFilters() {
    onQueryChange("")
    onStatusChange("all")
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description="Gestiona los feeds que convierten artículos nuevos en publicaciones programadas."
          title="Programaciones RSS"
        />
        <Card variant="subtle">
          <DataTableHeader
            action={
              canManage ? (
                <Button
                  className="hidden sm:inline-flex"
                  onClick={() => setWizardOpen(true)}
                  size="sm"
                >
                  <Plus />
                  Crear programación
                </Button>
              ) : undefined
            }
            search={{
              ariaLabel: "Buscar programaciones RSS",
              onChange: onQueryChange,
              placeholder: "Buscar programaciones...",
              value: query,
            }}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar>
              <DataTableFilter
                ariaLabel="Filtrar por estado"
                label="Estado"
                onValueChange={(value) =>
                  onStatusChange(value as "all" | RssScheduleStatus)
                }
                options={[
                  { label: "Todos", value: "all" },
                  { label: "Activas", value: "active" },
                  { label: "En pausa", value: "paused" },
                ]}
                value={status}
              />
            </DataTableToolbar>

            <div className="flex flex-1 flex-col gap-4">
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feed</TableHead>
                      <TableHead>Destinos</TableHead>
                      <TableHead>Próxima ejecución</TableHead>
                      <TableHead>Actividad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.length ? (
                      visibleRows.map((row) => {
                        const destinations = destinationsSummary(row.targets)
                        const isPending = pendingId === row.id

                        return (
                          <TableRow key={row.id}>
                            <TableCell>
                              <div className="flex min-w-64 items-center gap-3">
                                <Avatar size="lg">
                                  <AvatarFallback>
                                    <Rss className="size-4" />
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {row.name}
                                  </p>
                                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                                    <ExternalLink className="size-3 shrink-0" />
                                    {row.feedUrl}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="grid max-w-48 gap-0.5">
                                <span className="truncate text-sm">
                                  {destinations.primary}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {destinations.secondary}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-foreground">
                                {row.nextRun}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="grid gap-0.5">
                                <span className="text-sm">{row.lastRun}</span>
                                <span className="text-xs text-muted-foreground">
                                  {row.queued
                                    ? `${row.queued} borrador${row.queued === 1 ? "" : "es"} por revisar`
                                    : "Sin borradores generados"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {statusLabel[row.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      aria-label={`Abrir acciones para ${row.name}`}
                                      disabled={!canManage || isPending}
                                      size="icon-sm"
                                      variant="secondary"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      disabled={!canManage || isPending}
                                      onSelect={() => void runNow(row.id)}
                                    >
                                      <Play />
                                      Ejecutar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={!canManage || isPending}
                                      onSelect={() => void toggle(row.id)}
                                    >
                                      {row.status === "active" ? (
                                        <Pause />
                                      ) : (
                                        <Play />
                                      )}
                                      {row.status === "active"
                                        ? "Pausar"
                                        : "Reactivar"}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      disabled={!canManage || isPending}
                                      onSelect={() => void remove(row.id)}
                                      variant="destructive"
                                    >
                                      <Trash2 />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell className="h-24 text-center" colSpan={6}>
                          <EmptyState
                            action={
                              query || status !== "all" ? (
                                <Button
                                  onClick={resetFilters}
                                  variant="outline"
                                >
                                  Restablecer filtros
                                </Button>
                              ) : null
                            }
                            description={
                              query || status !== "all"
                                ? "Prueba con otro término o restablece los filtros."
                                : "Añade un feed y elige cuándo publicarlo en tus canales."
                            }
                            icon={Rss}
                            title={
                              query || status !== "all"
                                ? "No hay coincidencias"
                                : "Aún no tienes programaciones RSS"
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                canGoNext={page * pageSize < total}
                canGoPrevious={page > 1}
                itemLabel="programaciones"
                onNextPage={() => onPageChange(page + 1)}
                onPreviousPage={() => onPageChange(page - 1)}
                rangeEnd={rangeEnd}
                rangeStart={rangeStart}
                total={total}
              />
            </div>
          </CardContent>
        </Card>

        {canManage ? (
          <FloatingActionButton
            label="Crear programación"
            onClick={() => setWizardOpen(true)}
          />
        ) : null}
      </div>

      {canManage ? (
        <RssScheduleWizard
          accounts={accounts}
          onCreate={addSchedule}
          onOpenChange={setWizardOpen}
          onValidateFeed={validateFeed}
          open={wizardOpen}
        />
      ) : null}
    </>
  )
}
