"use client"

import { useMemo, useState } from "react"
import {
  CircleAlert,
  ClipboardList,
  DollarSign,
  PackageCheck,
  PackageX,
  ReceiptText,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import type {
  CommerceChannel,
  CommerceDashboardData,
  CommerceMetric,
  CommerceOrder,
  CommercePeriod,
  InventoryItem,
} from "@/features/commerce/types/commerce-dashboard"

type OrderFilter = "all" | CommerceOrder["status"]

const periodLabels: Record<CommercePeriod, string> = {
  month: "Este mes",
  quarter: "Este trimestre",
  year: "Este año",
}

const metricIcons: Record<CommerceMetric["id"], typeof DollarSign> = {
  average: ReceiptText,
  orders: ShoppingBag,
  returns: ClipboardList,
  sales: DollarSign,
}

const inventoryStatusMeta: Record<
  InventoryItem["status"],
  { label: string; variant: "destructive" | "success" | "warning" }
> = {
  healthy: { label: "Disponible", variant: "success" },
  low: { label: "Stock bajo", variant: "warning" },
  out: { label: "Sin stock", variant: "destructive" },
}

const orderStatusMeta: Record<
  CommerceOrder["status"],
  { label: string; variant: "info" | "success" | "warning" }
> = {
  attention: { label: "Requiere atención", variant: "warning" },
  completed: { label: "Completada", variant: "success" },
  processing: { label: "En proceso", variant: "info" },
}

function MetricCard({ metric }: { metric: CommerceMetric }) {
  const Icon = metricIcons[metric.id]
  const trendVariant = metric.trend === "up" ? "success" : "destructive"

  return (
    <Card size="sm" variant="subtle">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>{metric.label}</CardTitle>
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        </div>
        <CardDescription className="text-2xl font-semibold tracking-tight text-foreground">
          {metric.value}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-1.5">
        <Badge variant={trendVariant}>{metric.change}</Badge>
        <span className="text-xs text-muted-foreground">{metric.context}</span>
      </CardContent>
    </Card>
  )
}

function InventorySummary({ items }: { items: readonly InventoryItem[] }) {
  const summary = {
    healthy: items.filter((item) => item.status === "healthy").length,
    low: items.filter((item) => item.status === "low").length,
    out: items.filter((item) => item.status === "out").length,
  }

  return (
    <Card variant="subtle">
      <CardHeader>
        <CardTitle>Inventario</CardTitle>
        <CardDescription>
          Estado simulado de las referencias principales.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
            <PackageCheck
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <p className="text-lg font-semibold">{summary.healthy}</p>
            <p className="text-xs text-muted-foreground">disponibles</p>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
            <TriangleAlert
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <p className="text-lg font-semibold">{summary.low}</p>
            <p className="text-xs text-muted-foreground">por revisar</p>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
            <PackageX
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <p className="text-lg font-semibold">{summary.out}</p>
            <p className="text-xs text-muted-foreground">agotados</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const status = inventoryStatusMeta[item.status]

            return (
              <div
                className="flex items-start justify-between gap-3"
                key={item.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.sku} · {item.available} disponibles · {item.reserved}{" "}
                    reservadas
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function OrdersTable({ orders }: { orders: readonly CommerceOrder[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        description="No hay órdenes mock que coincidan con los filtros locales elegidos."
        icon={ShoppingBag}
        title="No encontramos órdenes"
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Orden</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead className="hidden md:table-cell">Artículos</TableHead>
          <TableHead className="hidden lg:table-cell">Actualizada</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const status = orderStatusMeta[order.status]

          return (
            <TableRow key={order.id}>
              <TableCell>
                <div className="min-w-0">
                  <p className="font-medium">{order.id}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {order.customer}
                  </p>
                </div>
              </TableCell>
              <TableCell className="capitalize">{order.channel}</TableCell>
              <TableCell className="hidden md:table-cell">
                {order.itemCount}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {order.updatedAt}
              </TableCell>
              <TableCell>
                <Badge variant={status.variant}>{status.label}</Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {order.total}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function CommercePermissionState() {
  return (
    <EmptyState
      description="Tu acceso actual no permite consultar el dashboard visual de Commerce."
      icon={ShoppingBag}
      title="Commerce no está disponible"
    />
  )
}

export function CommerceErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No se pudo cargar Commerce</AlertTitle>
      <AlertDescription>
        Ninguna orden ni inventario fue modificado. Intenta recuperar el
        dashboard visual.
      </AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={onRetry} variant="brand-secondary">
          Reintentar
        </Button>
      </div>
    </Alert>
  )
}

export function CommerceDashboardPage({
  dashboard,
}: {
  dashboard: CommerceDashboardData
}) {
  const [period, setPeriod] = useState<CommercePeriod>("month")
  const [channel, setChannel] = useState<CommerceChannel>("all")
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all")

  const filteredOrders = useMemo(
    () =>
      dashboard.orders.filter(
        (order) =>
          (channel === "all" || order.channel === channel) &&
          (orderFilter === "all" || order.status === orderFilter)
      ),
    [channel, dashboard.orders, orderFilter]
  )

  if (!dashboard.canView) return <CommercePermissionState />

  return (
    <div className="flex flex-col gap-5">
      <Alert>
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Dashboard visual mock</AlertTitle>
        <AlertDescription>
          Los indicadores y filtros usan fixtures locales y deterministas. Esta
          pantalla no consulta ni modifica API, órdenes, inventario o backend.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-medium">Resumen comercial</p>
          <p className="text-sm text-muted-foreground">
            Referencia visual para{" "}
            {periodLabels[period].toLocaleLowerCase("es")}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            onValueChange={(value) => setPeriod(value as CommercePeriod)}
            value={period}
          >
            <SelectTrigger aria-label="Periodo" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="quarter">Este trimestre</SelectItem>
                <SelectItem value="year">Este año</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => setChannel(value as CommerceChannel)}
            value={channel}
          >
            <SelectTrigger aria-label="Canal" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Todos los canales</SelectItem>
                <SelectItem value="store">Tienda</SelectItem>
                <SelectItem value="social">Social</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card variant="subtle">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Órdenes recientes</CardTitle>
                <CardDescription>
                  {filteredOrders.length} órdenes mock en la vista actual.
                </CardDescription>
              </div>
              <ToggleGroup
                aria-label="Filtrar órdenes por estado"
                onValueChange={(value) => {
                  if (value) setOrderFilter(value as OrderFilter)
                }}
                size="sm"
                spacing={0}
                type="single"
                value={orderFilter}
                variant="outline"
              >
                <ToggleGroupItem value="all">Todas</ToggleGroupItem>
                <ToggleGroupItem value="attention">Atención</ToggleGroupItem>
                <ToggleGroupItem value="processing">En proceso</ToggleGroupItem>
                <ToggleGroupItem value="completed">Completadas</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent className="px-4">
            <OrdersTable orders={filteredOrders} />
          </CardContent>
        </Card>

        <InventorySummary items={dashboard.inventory} />
      </div>
    </div>
  )
}
