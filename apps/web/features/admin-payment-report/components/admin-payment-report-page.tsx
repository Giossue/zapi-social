"use client"

import { useCallback, useEffect, useState } from "react"
import { Area, CartesianGrid, ComposedChart, XAxis } from "recharts"
import {
  BadgeDollarSign,
  CircleAlert,
  Receipt,
  RotateCcw,
  ShieldX,
  Wallet,
} from "lucide-react"

import { adminPaymentReportApi, ApiError } from "@workspace/api-client"
import type {
  AdminPaymentReport,
  AdminPaymentReportProduct,
  AdminPaymentReportRange,
  AdminPaymentReportStatusRow,
} from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CardGrid } from "@workspace/ui/components/card-grid"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { DataTableFilter } from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { MetricCard } from "@workspace/ui/components/metric-card"
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
import { useFormatter, useTranslations } from "next-intl"

const statusVariant: Record<
  AdminPaymentReportStatusRow["status"],
  "success" | "info" | "warning" | "secondary" | "destructive"
> = {
  paid: "success",
  pending: "info",
  partially_refunded: "warning",
  refunded: "secondary",
  failed: "destructive",
}

export function AdminPaymentReportPage() {
  const t = useTranslations("adminPaymentReport")
  const format = useFormatter()
  const chartConfig = {
    net: { label: t("metrics.net"), color: "var(--chart-1)" },
  } satisfies ChartConfig
  const reportMoney = (minor: number, currency: string) =>
    format.number(minor / 100, { currency, style: "currency" })
  /** El periodo llega como `YYYY-MM` o `YYYY-MM-DD` en UTC. */
  const periodLabel = (period: string) => {
    const [year, month, day] = period.split("-").map(Number)
    if (!year || !month) return period
    return format.dateTime(new Date(Date.UTC(year, month - 1, day ?? 1)), {
      ...(day
        ? { day: "numeric", month: "short" }
        : { month: "short", year: "numeric" }),
      timeZone: "UTC",
    })
  }
  const [report, setReport] = useState<AdminPaymentReport | null>(null)
  const [range, setRange] = useState<AdminPaymentReportRange>("30d")
  const [productType, setProductType] =
    useState<AdminPaymentReportProduct>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setReport(await adminPaymentReportApi.get({ productType, range }))
      setForbidden(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error("Admin payment report request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [productType, range])

  useEffect(() => {
    void load()
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

  if (isLoading && !report) {
    return <PageLoading aria-label={t("loading")} />
  }

  if (loadError || !report) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description={t("loadFailedDescription")}
        icon={CircleAlert}
        title={t("loadFailedTitle")}
      />
    )
  }

  const { currency, metrics } = report
  const series = report.series.map((point) => ({
    label: periodLabel(point.period),
    net: point.netMinor / 100,
  }))

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description={t("pageDescription")}
        title={t("pageTitle")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <DataTableFilter
          ariaLabel={t("selectRange")}
          label={t("rangeColumn")}
          onValueChange={(value) => setRange(value as AdminPaymentReportRange)}
          options={[
            { label: t("range.30d"), value: "30d" },
            { label: t("range.90d"), value: "90d" },
            { label: t("range.12m"), value: "12m" },
          ]}
          value={range}
        />
        <DataTableFilter
          ariaLabel={t("filterProduct")}
          label={t("product")}
          onValueChange={(value) =>
            setProductType(value as AdminPaymentReportProduct)
          }
          options={[
            { label: t("all"), value: "all" },
            { label: t("productType.plan"), value: "plan" },
            { label: t("productType.credits"), value: "credits" },
          ]}
          value={productType}
        />
        <p className="text-sm text-muted-foreground">
          {t("currencyNote", { currency })}
          {report.currencies.length > 1
            ? t("moreCurrencies", { count: report.currencies.length - 1 })
            : ""}
        </p>
      </div>

      <CardGrid>
        <MetricCard
          description={t("metrics.grossDescription")}
          icon={BadgeDollarSign}
          label={t("metrics.gross")}
          value={reportMoney(metrics.grossMinor, currency)}
        />
        <MetricCard
          description={t("metrics.netDescription")}
          icon={Wallet}
          label={t("metrics.net")}
          value={reportMoney(metrics.netMinor, currency)}
        />
        <MetricCard
          description={t("metrics.refundedDescription", {
            count: metrics.refundedCount,
          })}
          icon={RotateCcw}
          label={t("metrics.refunded")}
          value={reportMoney(metrics.refundedMinor, currency)}
        />
        <MetricCard
          description={t("metrics.ticketDescription", {
            failed: metrics.failedCount,
            paid: metrics.paidCount,
            pending: metrics.pendingCount,
          })}
          icon={Receipt}
          label={t("metrics.ticket")}
          value={reportMoney(metrics.averageTicketMinor, currency)}
        />
      </CardGrid>

      <Card variant="subtle">
        <CardHeader>
          <CardTitle className="leading-none">{t("trend")}</CardTitle>
          <CardDescription>
            Importe neto liquidado · {t(`range.${report.range}`).toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {series.length ? (
            <ChartContainer
              className="aspect-auto h-64 w-full"
              config={chartConfig}
            >
              <ComposedChart data={series} margin={{ top: 0 }}>
                <defs>
                  <linearGradient id="fillNet" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-net)"
                      stopOpacity={0.36}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-net)"
                      stopOpacity={0.04}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeOpacity={0.5} vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  minTickGap={32}
                  tickLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent className="w-44" indicator="line" />
                  }
                  cursor={false}
                />
                <Area
                  dataKey="net"
                  dot={false}
                  fill="url(#fillNet)"
                  fillOpacity={1}
                  stroke="var(--color-net)"
                  strokeWidth={1.25}
                  type="natural"
                />
              </ComposedChart>
            </ChartContainer>
          ) : (
            <EmptyState
              description={t("noSettledDescription")}
              icon={BadgeDollarSign}
              title={t("noMovements")}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="subtle">
          <CardHeader>
            <CardTitle className="text-base">{t("byProduct")}</CardTitle>
            <CardDescription>{t("byProductDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t("payments")}
                  </TableHead>
                  <TableHead className="text-right">{t("gross")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byProduct.length ? (
                  report.byProduct.map((row) => (
                    <TableRow key={`${row.productType}-${row.label}`}>
                      <TableCell>
                        <div className="flex min-w-40 flex-col">
                          <span className="font-medium">{row.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {row.productType === "plan"
                              ? t("productType.plan")
                              : t("productType.credits")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {row.count}
                      </TableCell>
                      <TableCell className="text-right">
                        {reportMoney(row.grossMinor, currency)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    colSpan={3}
                    description={t("noSettledPeriod")}
                    title={t("noData")}
                  />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card variant="subtle">
          <CardHeader>
            <CardTitle className="text-base">{t("byStatus")}</CardTitle>
            <CardDescription>{t("byStatusDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t("payments")}
                  </TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byStatus.length ? (
                  report.byStatus.map((row) => (
                    <TableRow key={row.status}>
                      <TableCell>
                        <Badge variant={statusVariant[row.status]}>
                          {t(`status.${row.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {row.count}
                      </TableCell>
                      <TableCell className="text-right">
                        {reportMoney(row.amountMinor, currency)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    colSpan={3}
                    description={t("noPaymentsPeriod")}
                    title={t("noData")}
                  />
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card variant="subtle">
        <CardHeader>
          <CardTitle className="text-base">{t("topWorkspaces")}</CardTitle>
          <CardDescription>{t("topWorkspacesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("workspace")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("payments")}
                </TableHead>
                <TableHead className="text-right">{t("gross")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.topWorkspaces.length ? (
                report.topWorkspaces.map((row) => (
                  <TableRow key={row.workspaceId}>
                    <TableCell className="font-medium">
                      {row.workspaceName}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {row.count}
                    </TableCell>
                    <TableCell className="text-right">
                      {reportMoney(row.grossMinor, currency)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmptyRow
                  colSpan={3}
                  description={t("noSettledPeriod")}
                  title={t("noData")}
                />
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
