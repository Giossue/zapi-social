"use client"

import { useCallback, useEffect, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import {
  Activity,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  ShieldCheck,
  Timer,
} from "lucide-react"

import { ApiError, adminAiApi } from "@workspace/api-client"
import type { AdminAiReport } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Calendar } from "@workspace/ui/components/calendar"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { loginPath } from "@/features/identity/login-redirect"

type Formatter = ReturnType<typeof useFormatter>

function money(format: Formatter, microusd: number) {
  return format.number(microusd / 1_000_000, {
    currency: "USD",
    maximumFractionDigits: 4,
    style: "currency",
  })
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function DateField({
  id,
  label,
  onChange,
  value,
}: {
  id: string
  label: string
  onChange: (next: string) => void
  value: string
}) {
  const t = useTranslations("aiReport")
  const format = useFormatter()
  return (
    <Field orientation="horizontal">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className="justify-start"
            id={id}
            role="combobox"
            type="button"
            variant="surface"
          >
            <CalendarRange data-icon="inline-start" />
            {value
              ? format.dateTime(new Date(`${value}T12:00:00.000Z`), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : t("pickDate")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            onSelect={(next) => next && onChange(toDateKey(next))}
            selected={value ? new Date(`${value}T12:00:00.000Z`) : undefined}
          />
        </PopoverContent>
      </Popover>
    </Field>
  )
}

export function AiReportPage() {
  const router = useRouter()
  const t = useTranslations("aiReport")
  const format = useFormatter()
  const [report, setReport] = useState<AdminAiReport | null>(null)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(
    async (range?: { from: string; to: string }) => {
      setIsLoading(true)
      setLoadError(false)
      try {
        const response = await adminAiApi.report(
          range?.from && range.to ? { from: range.from, to: range.to } : {}
        )
        setReport(response)
        setFrom(response.from)
        setTo(response.to)
        setForbidden(false)
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === "AUTH_SESSION_EXPIRED"
        ) {
          router.replace(loginPath())
          return
        }
        if (error instanceof ApiError && error.status === 403) {
          setForbidden(true)
          return
        }
        console.error("AI report request failed", error)
        setLoadError(true)
      } finally {
        setIsLoading(false)
      }
    },
    [router]
  )

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

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

  if (isLoading && !report) {
    return <PageLoading aria-label={t("loading")} />
  }

  if (loadError || !report) {
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

  const canApply = Boolean(from && to && from <= to)

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader description={t("description")} title={t("title")} />

      <Card variant="subtle">
        <CardContent className="py-4">
          <DataTableToolbar
            actions={
              <Button
                disabled={!canApply || isLoading}
                onClick={() => void load({ from, to })}
                size="sm"
              >
                <CalendarRange data-icon="inline-start" /> {t("apply")}
              </Button>
            }
          >
            <DateField
              id="report-from"
              label={t("from")}
              onChange={setFrom}
              value={from}
            />
            <DateField
              id="report-to"
              label={t("to")}
              onChange={setTo}
              value={to}
            />
          </DataTableToolbar>
        </CardContent>
      </Card>

      <CardGrid layout="md-3">
        <MetricCard
          description={t("metric.requests.description")}
          icon={Activity}
          label={t("metric.requests.label")}
          value={format.number(report.totals.requests)}
        />
        <MetricCard
          description={t("metric.successRate.description")}
          icon={CheckCircle2}
          label={t("metric.successRate.label")}
          value={t("percent", { value: report.totals.successRate })}
        />
        <MetricCard
          description={t("metric.tokens.description")}
          icon={Activity}
          label={t("metric.tokens.label")}
          value={format.number(report.totals.tokens)}
        />
        <MetricCard
          description={t("metric.cost.description")}
          icon={CircleDollarSign}
          label={t("metric.cost.label")}
          value={money(format, report.totals.estimatedCostMicrousd)}
        />
        <MetricCard
          description={t("metric.latency.description")}
          icon={Timer}
          label={t("metric.latency.label")}
          value={t("milliseconds", { value: report.totals.averageLatencyMs })}
        />
        <MetricCard
          description={t("metric.failed.description")}
          icon={CircleAlert}
          label={t("metric.failed.label")}
          value={format.number(report.totals.failed)}
        />
      </CardGrid>

      <Tabs defaultValue="daily">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="daily">{t("tab.daily")}</TabsTrigger>
          <TabsTrigger value="providers">{t("tab.providers")}</TabsTrigger>
        </TabsList>

        <TabsContent className="pt-3" value="daily">
          <Card variant="subtle">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dayColumn")}</TableHead>
                    <TableHead>{t("requestsColumn")}</TableHead>
                    <TableHead>{t("tokensColumn")}</TableHead>
                    <TableHead>{t("costColumn")}</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("successColumn")}
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("latencyColumn")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.daily.length ? (
                    report.daily.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">
                          {format.dateTime(
                            new Date(`${day.date}T12:00:00.000Z`),
                            { day: "numeric", month: "short" }
                          )}
                        </TableCell>
                        <TableCell>{format.number(day.requests)}</TableCell>
                        <TableCell>{format.number(day.tokens)}</TableCell>
                        <TableCell>
                          {money(format, day.estimatedCostMicrousd)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {t("percent", { value: day.successRate })}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {t("milliseconds", { value: day.averageLatencyMs })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmptyRow
                      colSpan={6}
                      description={t("emptyDescription")}
                      title={t("emptyTitle")}
                    />
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="pt-3" value="providers">
          <Card variant="subtle">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("providerColumn")}</TableHead>
                    <TableHead>{t("requestsColumn")}</TableHead>
                    <TableHead>{t("tokensColumn")}</TableHead>
                    <TableHead>{t("costColumn")}</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("successColumn")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byProvider.length ? (
                    report.byProvider.map((item) => (
                      <TableRow key={item.provider}>
                        <TableCell className="font-medium">
                          {item.provider}
                        </TableCell>
                        <TableCell>{format.number(item.requests)}</TableCell>
                        <TableCell>{format.number(item.tokens)}</TableCell>
                        <TableCell>
                          {money(format, item.estimatedCostMicrousd)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {t("percent", { value: item.successRate })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmptyRow
                      colSpan={5}
                      description={t("emptyDescription")}
                      title={t("emptyTitle")}
                    />
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
