"use client"

import { useCallback, useEffect, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
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
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@/components/page-loading"
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
import { TablePagination } from "@/components/table-pagination"
import { loginPath } from "@/features/identity/login-redirect"

type RequestLog = AdminAiRequestsResponse["requests"][number]

const pageSize = 25

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

export function AiUsageLogsPage() {
  const router = useRouter()
  const t = useTranslations("aiUsageLogs")
  const format = useFormatter()
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
            description={t("forbiddenDescription")}
            icon={ShieldCheck}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !data && !loadError) {
    return <PageLoading aria-label={t("loading")} />
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
            description={t("loadFailed")}
            icon={CircleAlert}
            title={t("unavailable")}
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
      <CollectionHeader description={t("description")} title={t("title")} />
      <Card variant="subtle">
        <DataTableHeader
          filters={
            <DataTableToolbar
              className="px-0"
              actions={
                provider !== "all" || status !== "all" ? (
                  <Button
                    onClick={clearFilters}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <X /> {t("clear")}
                  </Button>
                ) : undefined
              }
            >
              <DataTableFilter
                ariaLabel={t("filterProvider")}
                label={t("provider")}
                onValueChange={(value) => {
                  setProvider(value)
                  setPage(1)
                }}
                options={[
                  { label: t("all"), value: "all" },
                  ...data.providers.map((item) => ({
                    label: item,
                    value: item,
                  })),
                ]}
                value={provider}
              />
              <DataTableFilter
                ariaLabel={t("filterStatus")}
                label={t("statusColumn")}
                onValueChange={(value) => {
                  setStatus(value)
                  setPage(1)
                }}
                options={[
                  { label: t("all"), value: "all" },
                  { label: t("filter.succeeded"), value: "succeeded" },
                  { label: t("filter.failed"), value: "failed" },
                  { label: t("filter.queued"), value: "queued" },
                  { label: t("filter.processing"), value: "processing" },
                  { label: t("filter.cancelled"), value: "cancelled" },
                ]}
                value={status}
              />
            </DataTableToolbar>
          }
          loading={isLoading && Boolean(data)}
          search={{
            ariaLabel: t("searchAriaLabel"),
            onChange: (value) => {
              setQuery(value)
              setPage(1)
            },
            placeholder: t("searchPlaceholder"),
            value: query,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("requestColumn")}</TableHead>
                <TableHead>{t("userColumn")}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("modelColumn")}
                </TableHead>
                <TableHead>{t("usageColumn")}</TableHead>
                <TableHead>{t("statusColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.requests.length ? (
                data.requests.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex min-w-40 flex-col">
                        <span className="font-medium">
                          {t(`kind.${item.kind}`)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {format.dateTime(
                            new Date(item.createdAt),
                            "dateTime"
                          )}
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
                          {item.provider ?? t("internalProvider")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>
                          {t("tokens", {
                            count: item.inputTokens + item.outputTokens,
                          })}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {format.number(
                            item.estimatedCostMicrousd / 1_000_000,
                            {
                              currency: "USD",
                              maximumFractionDigits: 4,
                              style: "currency",
                            }
                          )}
                          {item.latencyMs
                            ? ` · ${t("latency", { ms: item.latencyMs })}`
                            : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={statusVariants[item.status]}>
                          {t(`status.${item.status}`)}
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
                        {t("resetFilters")}
                      </Button>
                    ) : undefined
                  }
                  colSpan={5}
                  description={
                    hasFilters
                      ? t("emptyFilteredDescription")
                      : t("emptyDescription")
                  }
                  title={hasFilters ? t("noMatches") : t("emptyTitle")}
                />
              )}
            </TableBody>
          </Table>
          <TablePagination
            canGoNext={safePage < pageCount}
            canGoPrevious={safePage > 1}
            itemLabel={t("itemLabel")}
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
