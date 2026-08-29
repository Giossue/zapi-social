"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"
import { BadgeCheck, CircleAlert, ShieldX } from "lucide-react"

import { ApiError, adminReportsApi } from "@workspace/api-client"
import type { AdminUserReportResponse } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import { PageLoading } from "@/components/page-loading"
import { useApiErrorMessage } from "@/lib/api-error-message"
import { loginPath } from "@/features/identity/login-redirect"

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined
}

export function AdminUserReportPage() {
  const t = useTranslations("adminUserReport")
  const format = useFormatter()
  const router = useRouter()
  const apiErrorMessage = useApiErrorMessage()

  const [data, setData] = useState<AdminUserReportResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    setLoadFailed(false)
    try {
      setData(await adminReportsApi.userReport())
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(loginPath())
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      setLoadFailed(true)
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setIsLoading(false)
    }
  }, [apiErrorMessage, router])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  if (forbidden) {
    return (
      <EmptyState
        description={t("forbiddenDescription")}
        icon={ShieldX}
        title={t("forbiddenTitle")}
      />
    )
  }

  if (isLoading && !data) return <PageLoading aria-label={t("loading")} />

  if (loadFailed || !data) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description={t("loadFailedDescription")}
        icon={CircleAlert}
        title={t("loadFailedTitle")}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description={t("pageDescription")}
        title={t("pageTitle")}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>{t("byMonth")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5">
              {data.signupsByMonth.map((entry) => (
                <li
                  className="flex items-center justify-between gap-3 text-sm"
                  key={entry.month}
                >
                  <span className="text-muted-foreground">{entry.month}</span>
                  <span className="tabular-nums">
                    {format.number(entry.count)}
                  </span>
                </li>
              ))}
              {data.signupsByMonth.length ? null : (
                <li className="text-sm text-muted-foreground">{t("noData")}</li>
              )}
            </ul>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>{t("byLocale")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5">
                {data.byLocale.map((entry) => (
                  <li
                    className="flex items-center justify-between gap-3 text-sm"
                    key={entry.locale}
                  >
                    <span className="text-muted-foreground">
                      {entry.locale}
                    </span>
                    <span className="tabular-nums">
                      {format.number(entry.count)}
                    </span>
                  </li>
                ))}
                {data.byLocale.length ? null : (
                  <li className="text-sm text-muted-foreground">
                    {t("noData")}
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>{t("byPlan")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5">
                {data.workspacesByPlan.map((entry) => (
                  <li
                    className="flex items-center justify-between gap-3 text-sm"
                    key={entry.plan}
                  >
                    <span className="text-muted-foreground">{entry.plan}</span>
                    <span className="tabular-nums">
                      {format.number(entry.count)}
                    </span>
                  </li>
                ))}
                {data.workspacesByPlan.length ? null : (
                  <li className="text-sm text-muted-foreground">
                    {t("noData")}
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      <Card variant="subtle">
        <CardHeader>
          <CardTitle>{t("recentTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("userColumn")}</TableHead>
                <TableHead className="max-md:hidden">
                  {t("planColumn")}
                </TableHead>
                <TableHead>{t("statusColumn")}</TableHead>
                <TableHead className="max-lg:hidden">
                  {t("signupColumn")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="grid gap-0.5">
                      <span className="font-medium">{user.displayName}</span>
                      <span className="text-sm text-muted-foreground">
                        {user.email}
                        {user.locale ? ` · ${user.locale}` : ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-md:hidden">
                    {user.planName ?? t("noPlan")}
                  </TableCell>
                  <TableCell>
                    {user.verified ? (
                      <Badge variant="success">
                        <BadgeCheck data-icon="inline-start" />
                        {t("verifiedBadge")}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">{t("unverifiedBadge")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-lg:hidden">
                    {format.dateTime(new Date(user.createdAt), "date")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
