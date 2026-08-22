"use client"

import { useCallback, useEffect, useState } from "react"
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
import { DataTableToolbar } from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Calendar } from "@workspace/ui/components/calendar"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { MetricCard } from "@workspace/ui/components/metric-card"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { loginPath } from "@/features/identity/login-redirect"

function money(microusd: number) {
  return new Intl.NumberFormat("es-EC", {
    currency: "USD",
    maximumFractionDigits: 4,
    style: "currency",
  }).format(microusd / 1_000_000)
}

function number(value: number) {
  return new Intl.NumberFormat("es-EC").format(value)
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function longDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`))
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
            {value ? longDate(value) : "Elegir fecha"}
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00.000Z`))
}

export function AiReportPage() {
  const router = useRouter()
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
    void load()
  }, [load])

  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description="Solicita a un administrador el permiso necesario para ver el informe de IA."
            icon={ShieldCheck}
            title="Informe no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !report) {
    return <PageLoading aria-label="Cargando informe de IA" />
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
            description="No pudimos calcular el informe de consumo de IA."
            icon={CircleAlert}
            title="Informe no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  const canApply = Boolean(from && to && from <= to)

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description="Consumo de IA por día y por proveedor dentro del rango elegido."
        title="Informe de IA"
      />

      <Card variant="subtle">
        <CardContent className="py-4">
          <DataTableToolbar
            actions={
              <Button
                disabled={!canApply || isLoading}
                onClick={() => void load({ from, to })}
                size="sm"
              >
                <CalendarRange data-icon="inline-start" /> Aplicar
              </Button>
            }
          >
            <DateField
              id="report-from"
              label="Desde"
              onChange={setFrom}
              value={from}
            />
            <DateField
              id="report-to"
              label="Hasta"
              onChange={setTo}
              value={to}
            />
          </DataTableToolbar>
        </CardContent>
      </Card>

      <CardGrid layout="md-3">
        <MetricCard
          description="Generaciones en el rango"
          icon={Activity}
          label="Solicitudes"
          value={number(report.totals.requests)}
        />
        <MetricCard
          description="Terminadas correctamente"
          icon={CheckCircle2}
          label="Tasa de éxito"
          value={`${report.totals.successRate}%`}
        />
        <MetricCard
          description="Entrada más salida"
          icon={Activity}
          label="Tokens"
          value={number(report.totals.tokens)}
        />
        <MetricCard
          description="Consumo calculado"
          icon={CircleDollarSign}
          label="Costo estimado"
          value={money(report.totals.estimatedCostMicrousd)}
        />
        <MetricCard
          description="Promedio por solicitud"
          icon={Timer}
          label="Latencia media"
          value={`${number(report.totals.averageLatencyMs)} ms`}
        />
        <MetricCard
          description="Terminadas con error"
          icon={CircleAlert}
          label="Fallidas"
          value={number(report.totals.failed)}
        />
      </CardGrid>

      <Tabs defaultValue="daily">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="daily">Por día</TabsTrigger>
          <TabsTrigger value="providers">Por proveedor</TabsTrigger>
        </TabsList>

        <TabsContent className="pt-3" value="daily">
          <Card variant="subtle">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead>Solicitudes</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Éxito
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Latencia
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.daily.length ? (
                    report.daily.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">
                          {formatDate(day.date)}
                        </TableCell>
                        <TableCell>{number(day.requests)}</TableCell>
                        <TableCell>{number(day.tokens)}</TableCell>
                        <TableCell>
                          {money(day.estimatedCostMicrousd)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {day.successRate}%
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {number(day.averageLatencyMs)} ms
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmptyRow
                      colSpan={6}
                      description="No hay generaciones registradas en este rango."
                      title="Sin actividad"
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
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Solicitudes</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Éxito
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
                        <TableCell>{number(item.requests)}</TableCell>
                        <TableCell>{number(item.tokens)}</TableCell>
                        <TableCell>
                          {money(item.estimatedCostMicrousd)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {item.successRate}%
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmptyRow
                      colSpan={5}
                      description="No hay generaciones registradas en este rango."
                      title="Sin actividad"
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
