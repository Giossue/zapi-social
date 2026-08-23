"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { Activity, RefreshCw } from "lucide-react"
import { auditApi } from "@workspace/api-client"
import type { AdminAuditEvent } from "@workspace/contracts"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@/components/page-loading"
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
import { TablePagination } from "@/components/table-pagination"

const sourceLabels = { web: "Web", api: "API", worker: "Worker" } as const
const severityVariant = {
  success: "success",
  warning: "warning",
  error: "destructive",
} as const
const PAGE_SIZE = 10

export function AuditEventsPage() {
  const t = useTranslations("audit")
  const format = useFormatter()
  const locale = useLocale()
  const [events, setEvents] = useState<AdminAuditEvent[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState("")
  const [source, setSource] = useState("all")
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setLoadError(false)
    try {
      const response = await auditApi.list()
      setEvents(response.events)
    } catch (caught) {
      console.error("Audit events request failed", caught)
      setLoadError(true)
      setEvents([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale)
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
        .toLocaleLowerCase(locale)
      return matchesSource && (!needle || searchable.includes(needle))
    })
  }, [events, locale, query, source])
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
      ) : loadError ? (
        <Card variant="subtle">
          <EmptyState
            action={
              <RetryButton
                onClick={() => void load()}
                variant="brand-secondary"
              />
            }
            description={t("loadFailed")}
            icon={Activity}
            title={t("unavailable")}
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
                {refreshing ? t("refreshing") : t("refresh")}
              </Button>
            }
            description={t("description")}
            search={{
              ariaLabel: t("searchAriaLabel"),
              onChange: (value) => {
                setQuery(value)
                setPage(1)
              },
              placeholder: t("searchPlaceholder"),
              value: query,
            }}
            title={t("title")}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar>
              <DataTableFilter
                ariaLabel={t("filterSource")}
                label={t("sourceColumn")}
                onValueChange={(value) => {
                  setSource(value)
                  setPage(1)
                }}
                options={[
                  { label: t("allSources"), value: "all" },
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
                  <TableHead>{t("eventColumn")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("sourceColumn")}
                  </TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("accountColumn")}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("workspaceColumn")}
                  </TableHead>
                  <TableHead>{t("dateColumn")}</TableHead>
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
                    <TableCell className="hidden md:table-cell">
                      {sourceLabels[item.source]}
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityVariant[item.severity]}>
                        {t(`severity.${item.severity}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.actorName ?? item.actorEmail ?? t("system")}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {item.workspaceName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format.dateTime(new Date(item.createdAt), "dateTime")}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableEmptyRow
                    colSpan={6}
                    description={
                      events.length === 0
                        ? t("emptyDescription")
                        : t("emptyFilteredDescription")
                    }
                    title={
                      events.length === 0 ? t("emptyTitle") : t("noMatches")
                    }
                  />
                ) : null}
              </TableBody>
            </Table>
            <TablePagination
              canGoNext={currentPage < pageCount}
              canGoPrevious={currentPage > 1}
              itemLabel={t("itemLabel")}
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
