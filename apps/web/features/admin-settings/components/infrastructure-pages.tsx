"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { CircleAlert, ShieldCheck, Trash2 } from "lucide-react"

import { ApiError, adminSettingsApi } from "@workspace/api-client"
import type { AdminCacheState, AdminScheduledJobs } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
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
import { toast } from "@workspace/ui/components/toast"
import { loginPath } from "@/features/identity/login-redirect"

function useAdminResource<T>(load: () => Promise<T>, label: string) {
  const router = useRouter()
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setData(await loadRef.current())
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
      console.error(`${label} request failed`, error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [label, router])

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0)
    return () => clearTimeout(timer)
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
  const t = useTranslations("infrastructure")
  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={ShieldCheck}
            title={t("unavailable", { section: title })}
          />
        </CardContent>
      </Card>
    )
  }
  if (isLoading && !ready) {
    return <PageLoading aria-label={t("loading", { section: title })} />
  }
  if (loadError || !ready) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={<RetryButton onClick={onRetry} variant="brand-secondary" />}
            description={t("loadFailed")}
            icon={CircleAlert}
            title={t("unavailable", { section: title })}
          />
        </CardContent>
      </Card>
    )
  }
  return <>{children}</>
}

export function CacheSettingsPage() {
  const t = useTranslations("infrastructure")
  const { data, forbidden, isLoading, loadError, refresh, setData } =
    useAdminResource<AdminCacheState>(
      () => adminSettingsApi.cache(),
      t("cache.title")
    )
  const [pending, setPending] = useState(false)

  async function purge() {
    setPending(true)
    try {
      const result = await adminSettingsApi.purgeCache()
      toast.success(t("cache.purged", { count: result.removed }))
      setData(await adminSettingsApi.cache())
    } catch (error) {
      console.error("Cache purge failed", error)
      toast.error(t("cache.purgeFailed"))
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
      title={t("cache.title")}
    >
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("cache.description")}
          title={t("cache.title")}
        />
        <Card variant="subtle">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium">{t("cache.purgeTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t.rich("cache.purgeHint", {
                  code: (chunks) => <code>{chunks}</code>,
                })}
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
              {t("cache.purgeAction")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </StateGuard>
  )
}

export function CronsSettingsPage() {
  const t = useTranslations("infrastructure")
  const format = useFormatter()
  const { data, forbidden, isLoading, loadError, refresh } =
    useAdminResource<AdminScheduledJobs>(
      () => adminSettingsApi.scheduledJobs(),
      t("crons.title")
    )

  return (
    <StateGuard
      forbidden={forbidden}
      isLoading={isLoading}
      loadError={loadError}
      onRetry={() => void refresh()}
      ready={Boolean(data)}
      title={t("crons.title")}
    >
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("crons.description")}
          title={t("crons.title")}
        />
        <Card variant="subtle">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("crons.jobColumn")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("crons.frequencyColumn")}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("crons.nextRunColumn")}
                  </TableHead>
                  <TableHead>{t("crons.queueColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.jobs.length ? (
                  data.jobs.map((job) => (
                    <TableRow key={job.queue}>
                      <TableCell>
                        <div className="flex min-w-40 flex-col">
                          <span className="font-medium">
                            {t(`crons.queue.${job.queue}`)}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {job.queue}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {job.everyMinutes
                          ? t("crons.everyMinutes", {
                              minutes: job.everyMinutes,
                            })
                          : t("crons.onDemand")}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {job.nextRunAt
                          ? format.dateTime(new Date(job.nextRunAt), "dateTime")
                          : t("never")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="neutral">
                            {t("crons.waiting", { count: job.waiting })}
                          </Badge>
                          {job.delayed ? (
                            <Badge variant="info">
                              {t("crons.delayed", { count: job.delayed })}
                            </Badge>
                          ) : null}
                          {job.failed ? (
                            <Badge variant="destructive">
                              {t("crons.failed", { count: job.failed })}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    colSpan={4}
                    description={t("crons.emptyDescription")}
                    title={t("crons.emptyTitle")}
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
