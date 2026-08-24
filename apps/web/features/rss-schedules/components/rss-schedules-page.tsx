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
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { PageLoading } from "@/components/page-loading"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@/components/table-pagination"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"

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

function toRssScheduleRow(schedule: PortalRssSchedule): RssSchedule {
  return {
    feedUrl: schedule.feedUrl,
    id: schedule.id,
    lastRunAt: schedule.lastQueuedAt ?? schedule.lastCheckedAt,
    name: schedule.name,
    nextRunAt: schedule.nextRunAt,
    queued: schedule.queuedCount,
    status: schedule.status,
    targets: schedule.targets.map((target) => target.displayName),
  }
}

function setupTargetAccounts(
  accounts: Awaited<ReturnType<typeof publishingApi.list>>["accounts"],
  connectedLabel: string
) {
  return accounts
    .filter((account) => account.connected)
    .map((account) => ({
      description: connectedLabel,
      id: account.id,
      label: `${providerLabel[account.provider]} · ${account.name}`,
    }))
}

function clientTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

function scheduleError(
  error: unknown,
  fallback: string,
  validationMessage: string
) {
  if (error instanceof ApiError && error.code === "VALIDATION_FAILED")
    return validationMessage
  return fallback
}

export function RssSchedulesPage() {
  const t = useTranslations("rssSchedules")
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
          accounts: setupTargetAccounts(publishing.accounts, t("connected")),
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
  }, [setupReloadToken, t])

  useEffect(() => {
    let isCurrent = true
    const trimmedQuery = deferredQuery.trim()

    const timer = setTimeout(() => {
      setListState({ status: "loading" })
    }, 0)
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
      clearTimeout(timer)
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
  const t = useTranslations("rssSchedules")
  const format = useFormatter()
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
    toast.success(t("created"))
    onRefresh()
  }

  async function validateFeed(feedUrl: string) {
    await rssSchedulesApi.validateFeed({ feedUrl })
  }

  async function toggle(id: string) {
    setPendingId(id)
    try {
      const schedule = await rssSchedulesApi.toggle(id)
      toast.success(schedule.status === "active" ? t("resumed") : t("paused"))
      onRefresh()
    } catch (error) {
      toast.error(
        scheduleError(error, t("updateFailed"), t("validationFailed"))
      )
    } finally {
      setPendingId(null)
    }
  }

  async function remove(id: string) {
    setPendingId(id)
    try {
      await rssSchedulesApi.remove(id)
      toast.success(t("deleted"))
      onRefresh()
    } catch (error) {
      toast.error(
        scheduleError(error, t("deleteFailed"), t("validationFailed"))
      )
    } finally {
      setPendingId(null)
    }
  }

  async function runNow(id: string) {
    setPendingId(id)
    try {
      await rssSchedulesApi.run(id)
      toast.success(t("runQueued"))
      onRefresh()
    } catch (error) {
      toast.error(scheduleError(error, t("runFailed"), t("validationFailed")))
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
          description={t("pageDescription")}
          title={t("pageTitle")}
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
                  {t("create")}
                </Button>
              ) : undefined
            }
            search={{
              ariaLabel: t("searchLabel"),
              onChange: onQueryChange,
              placeholder: t("searchPlaceholder"),
              value: query,
            }}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar>
              <DataTableFilter
                ariaLabel={t("filterStatus")}
                label={t("status")}
                onValueChange={(value) =>
                  onStatusChange(value as "all" | RssScheduleStatus)
                }
                options={[
                  { label: t("filter.all"), value: "all" },
                  { label: t("filter.active"), value: "active" },
                  { label: t("filter.paused"), value: "paused" },
                ]}
                value={status}
              />
            </DataTableToolbar>

            <div className="flex flex-1 flex-col gap-4">
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("feed")}</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t("targets")}
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        {t("nextRunColumn")}
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t("activity")}
                      </TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead className="text-right">
                        {t("actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.length ? (
                      visibleRows.map((row) => {
                        const [firstTarget, ...otherTargets] = row.targets
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
                            <TableCell className="hidden lg:table-cell">
                              <div className="grid max-w-48 gap-0.5">
                                <span className="truncate text-sm">
                                  {firstTarget ?? t("noTargets")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {otherTargets.length
                                    ? t("moreTargets", {
                                        count: otherTargets.length,
                                      })
                                    : firstTarget
                                      ? t("oneChannel")
                                      : ""}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-sm text-foreground">
                                {row.nextRunAt
                                  ? format.dateTime(new Date(row.nextRunAt), {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })
                                  : row.status === "paused"
                                    ? t("statusLabel.paused")
                                    : t("pendingFirstRun")}
                              </span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="grid gap-0.5">
                                <span className="text-sm">
                                  {row.lastRunAt
                                    ? format.dateTime(new Date(row.lastRunAt), {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      })
                                    : t("neverRun")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {row.queued
                                    ? t("queuedDrafts", { count: row.queued })
                                    : t("noDrafts")}
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
                                {t(`statusLabel.${row.status}`)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      aria-label={t("openActions", {
                                        name: row.name,
                                      })}
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
                                      {t("run")}
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
                                        ? t("pause")
                                        : t("resume")}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      disabled={!canManage || isPending}
                                      onSelect={() => void remove(row.id)}
                                      variant="destructive"
                                    >
                                      <Trash2 />
                                      {t("delete")}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableEmptyRow
                        colSpan={6}
                        action={
                          query || status !== "all" ? (
                            <Button onClick={resetFilters} variant="outline">
                              {t("resetFilters")}
                            </Button>
                          ) : null
                        }
                        description={
                          query || status !== "all"
                            ? t("emptyFilteredDescription")
                            : t("emptyDescription")
                        }
                        title={
                          query || status !== "all"
                            ? t("noMatches")
                            : t("emptyTitle")
                        }
                      />
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                canGoNext={page * pageSize < total}
                canGoPrevious={page > 1}
                itemLabel={t("itemLabel")}
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
            label={t("create")}
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
