"use client"

import * as React from "react"
import { adminOperationsApi, ApiError } from "@workspace/api-client"
import type { AdminOperationActionKey } from "@workspace/contracts"
import type { LucideIcon } from "lucide-react"
import {
  BadgeDollarSign,
  Check,
  CircleAlert,
  CircleDollarSign,
  EllipsisVertical,
  Eye,
  HandCoins,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldX,
  Tags,
  Trash2,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { toast } from "@workspace/ui/components/toast"
import { CardGrid } from "@workspace/ui/components/card-grid"

import { Badge } from "@workspace/ui/components/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@workspace/ui/components/page-loading"
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
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

export type AdminModuleKey =
  "users" | "credits" | "affiliate" | "coupons" | "payments" | "subscriptions"
type Tone = "success" | "warning" | "neutral" | "destructive"
type Icon = LucideIcon

type Metric = { label: string; value: string; description: string; icon: Icon }
type Cell = { primary: string; secondary?: string; mono?: boolean }
type Action = {
  key?: AdminOperationActionKey
  label: string
  kind?: "destructive" | "success"
}
type Row = {
  id: string
  cells: Cell[]
  status: string
  tone: Tone
  actions: Action[]
}
type Tab = {
  value: string
  label: string
  searchPlaceholder: string
  columns: string[]
  metricIcons: Record<string, Icon>
  primaryAction?: {
    label: string
    icon: Icon
    dialogTitle: string
    dialogDescription: string
    fields: string[]
  }
}
type Module = { title: string; description: string; tabs: [Tab, ...Tab[]] }

const modules: Record<AdminModuleKey, Module> = {
  users: {
    title: "Usuarios",
    description: "Administra las cuentas de Portal, su acceso, plan y estado.",
    tabs: [
      {
        value: "users",
        label: "Usuarios",
        searchPlaceholder: "Buscar por nombre o correo...",
        columns: ["Usuario", "Acceso", "Plan", "Espacio", "Registro"],
        metricIcons: {
          ["Usuarios"]: Users,
          ["Nuevos"]: UserPlus,
          ["Con plan"]: WalletCards,
          ["Por revisar"]: ShieldX,
        },
        primaryAction: {
          label: "Crear usuario",
          icon: UserPlus,
          dialogTitle: "Crear usuario",
          dialogDescription:
            "Crea una cuenta de Portal y asigna su acceso inicial.",
          fields: ["Nombre visible", "Correo electrónico", "Plan"],
        },
      },
    ],
  },
  credits: {
    title: "Créditos",
    description:
      "Controla paquetes, movimientos y consumo de créditos del sistema.",
    tabs: [
      {
        value: "packs",
        label: "Paquetes",
        searchPlaceholder: "Buscar paquete...",
        columns: ["Paquete", "Créditos", "Precio", "Compras", "Orden"],
        metricIcons: {
          ["Paquetes"]: BadgeDollarSign,
          ["Activos"]: Check,
          ["Destacados"]: PackagePlus,
          ["Ventas"]: ReceiptText,
        },
        primaryAction: {
          label: "Añadir paquete",
          icon: PackagePlus,
          dialogTitle: "Nuevo paquete de créditos",
          dialogDescription:
            "Define una oferta de recarga disponible para los clientes.",
          fields: ["Nombre", "Créditos", "Precio"],
        },
      },
      {
        value: "ledger",
        label: "Movimientos",
        searchPlaceholder: "Buscar usuario, paquete o movimiento...",
        columns: ["Usuario", "Tipo", "Paquete", "Créditos", "Saldo", "Fecha"],
        metricIcons: {
          ["Movimientos"]: ReceiptText,
          ["Compras"]: CircleDollarSign,
          ["Otorgados"]: BadgeDollarSign,
          ["Disponibles"]: WalletCards,
        },
      },
      {
        value: "usage",
        label: "Uso",
        searchPlaceholder: "Buscar usuario, acción o función...",
        columns: [
          "Usuario",
          "Acción",
          "Función",
          "Créditos",
          "Cantidad",
          "Fecha",
        ],
        metricIcons: {
          ["Registros"]: ReceiptText,
          ["Consumidos"]: BadgeDollarSign,
          ["Usuarios"]: Users,
          ["Acciones"]: RotateCcw,
        },
      },
    ],
  },
  affiliate: {
    title: "Afiliados",
    description: "Revisa referidos, comisiones y solicitudes de retiro.",
    tabs: [
      {
        value: "overview",
        label: "Afiliados",
        searchPlaceholder: "Buscar afiliado o código...",
        columns: ["Afiliado", "Código", "Clics", "Conversiones", "Saldo"],
        metricIcons: {
          ["Afiliados"]: HandCoins,
          ["Clics"]: Eye,
          ["Conversiones"]: Check,
          ["Aprobado"]: CircleDollarSign,
        },
      },
      {
        value: "commissions",
        label: "Comisiones",
        searchPlaceholder: "Buscar afiliado, referido o pago...",
        columns: ["Afiliado", "Referido", "Pago", "Comisión", "Creada"],
        metricIcons: {
          ["Comisiones"]: ReceiptText,
          ["Pendientes"]: RotateCcw,
          ["Disponibles"]: CircleDollarSign,
          ["Rechazadas"]: X,
        },
      },
      {
        value: "withdrawals",
        label: "Retiros",
        searchPlaceholder: "Buscar afiliado, retiro o método...",
        columns: ["Afiliado", "Solicitud", "Método", "Importe", "Solicitada"],
        metricIcons: {
          ["Solicitudes"]: ReceiptText,
          ["Pendientes"]: RotateCcw,
          ["Aprobados"]: Check,
          ["Pagados"]: CircleDollarSign,
        },
      },
    ],
  },
  coupons: {
    title: "Cupones",
    description: "Administra descuentos, vigencia, límites y planes elegibles.",
    tabs: [
      {
        value: "coupons",
        label: "Cupones",
        searchPlaceholder: "Buscar nombre, código o descuento...",
        columns: ["Cupón", "Descuento", "Uso", "Planes", "Vigencia"],
        metricIcons: {
          ["Cupones"]: Tags,
          ["Activos"]: Check,
          ["Canjes"]: ReceiptText,
          ["Sin límite"]: RotateCcw,
        },
        primaryAction: {
          label: "Crear cupón",
          icon: Plus,
          dialogTitle: "Crear cupón",
          dialogDescription:
            "Configura el descuento que Polar aplicará durante el checkout.",
          fields: ["Nombre", "Código", "Valor del descuento"],
        },
      },
    ],
  },
  payments: {
    title: "Pagos",
    description:
      "Consulta transacciones procesadas únicamente mediante Polar.sh.",
    tabs: [
      {
        value: "payments",
        label: "Pagos",
        searchPlaceholder: "Buscar factura, usuario o transacción...",
        columns: [
          "Factura",
          "Usuario",
          "Producto",
          "Transacción",
          "Importe",
          "Fecha",
        ],
        metricIcons: {
          ["Transacciones"]: ReceiptText,
          ["Completadas"]: Check,
          ["Reembolsadas"]: RotateCcw,
          ["Volumen"]: CircleDollarSign,
        },
      },
    ],
  },
  subscriptions: {
    title: "Suscripciones",
    description:
      "Supervisa renovaciones, cobros fallidos y cancelaciones en Polar.sh.",
    tabs: [
      {
        value: "subscriptions",
        label: "Suscripciones",
        searchPlaceholder: "Buscar suscripción, cliente o plan...",
        columns: [
          "Suscripción",
          "Cliente",
          "Plan",
          "Importe",
          "Renovación",
          "Actualizada",
        ],
        metricIcons: {
          ["Suscripciones"]: ReceiptText,
          ["Activas"]: Check,
          ["En mora"]: RotateCcw,
          ["MRR"]: CircleDollarSign,
        },
      },
    ],
  },
}

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  if (tone === "success")
    return (
      <Badge variant="success">
        <span className="size-1.5 rounded-full bg-success" />
        {label}
      </Badge>
    )
  if (tone === "destructive")
    return <Badge variant="destructive">{label}</Badge>
  if (tone === "warning")
    return (
      <Badge variant="warning">
        <span className="size-1.5 rounded-full bg-current" />
        {label}
      </Badge>
    )
  return <Badge variant="neutral">{label}</Badge>
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <FieldLabel>
      {children}
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
    </FieldLabel>
  )
}

function RowActionIcon({ action, index }: { action: Action; index: number }) {
  if (action.kind === "destructive") return <Trash2 />
  if (action.kind === "success") return <Check />
  if (index === 0) return <Eye />
  return <Pencil />
}

function editValuesFor(
  moduleKey: AdminModuleKey,
  row: Row,
  fieldCount: number
) {
  if (moduleKey === "users") {
    return [
      row.cells[0]?.primary ?? "",
      row.cells[0]?.secondary ?? "",
      row.cells[2]?.primary ?? "",
    ]
  }
  if (moduleKey === "credits") {
    return [
      row.cells[0]?.primary ?? "",
      row.cells[1]?.primary ?? "",
      row.cells[2]?.primary ?? "",
    ]
  }
  if (moduleKey === "coupons") {
    return [
      row.cells[0]?.primary ?? "",
      row.cells[0]?.secondary ?? "",
      row.cells[1]?.primary ?? "",
    ]
  }
  return Array.from({ length: fieldCount }, () => "")
}

export function AdminModulePreview({
  moduleKey,
}: {
  moduleKey: AdminModuleKey
}) {
  const moduleConfig = modules[moduleKey]
  const firstTab = moduleConfig.tabs[0]
  const [activeTab, setActiveTab] = React.useState(firstTab.value)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [pageIndex, setPageIndex] = React.useState(0)
  const pageSize = 10
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingRowId, setEditingRowId] = React.useState<string | null>(null)
  const [detailRow, setDetailRow] = React.useState<Row | null>(null)
  const [formValues, setFormValues] = React.useState<string[]>([])
  const [remote, setRemote] = React.useState<Awaited<
    ReturnType<typeof adminOperationsApi.view>
  > | null>(null)
  const [requestState, setRequestState] = React.useState<
    "loading" | "ready" | "error" | "forbidden"
  >("loading")
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [saving, setSaving] = React.useState(false)
  const [pendingDestructive, setPendingDestructive] = React.useState<{
    action: string
    actionKey: AdminOperationActionKey
    id: string
    resource: string
  } | null>(null)
  const active =
    moduleConfig.tabs.find((tab) => tab.value === activeTab) ?? firstTab
  const rows = remote?.rows ?? []
  const statuses = remote?.statusOptions ?? []
  const pageCount = remote?.pagination.pageCount ?? 1
  const currentPageIndex = (remote?.pagination.page ?? pageIndex + 1) - 1
  const paginatedRows = rows
  const rangeStart = remote?.pagination.rangeStart ?? 0
  const rangeEnd = remote?.pagination.rangeEnd ?? 0
  const total = remote?.pagination.total ?? 0
  const metrics: Metric[] = (remote?.metrics ?? []).map((metric) => ({
    ...metric,
    icon: active.metricIcons[metric.label] ?? CircleAlert,
  }))
  const primaryAction = active.primaryAction
  const PrimaryIcon = primaryAction?.icon
  const formComplete =
    primaryAction?.fields.every((_, index) =>
      Boolean(formValues[index]?.trim())
    ) ?? true

  React.useEffect(() => {
    let current = true
    const timer = window.setTimeout(
      () => {
        setRequestState((current) =>
          current === "ready" ? current : "loading"
        )
        void adminOperationsApi
          .view(moduleKey, {
            tab: activeTab,
            q: search || undefined,
            status,
            page: pageIndex + 1,
            pageSize,
          })
          .then((response) => {
            if (!current) return
            setRemote(response)
            setRequestState("ready")
          })
          .catch((error: unknown) => {
            if (!current) return
            setRequestState(
              error instanceof ApiError && error.status === 403
                ? "forbidden"
                : "error"
            )
          })
      },
      search ? 250 : 0
    )
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [activeTab, moduleKey, pageIndex, pageSize, refreshKey, search, status])

  if (requestState === "error") {
    return (
      <EmptyState
        action={
          <RetryButton
            onClick={() => setRefreshKey((current) => current + 1)}
          />
        }
        description={`No fue posible cargar ${moduleConfig.title.toLowerCase()}.`}
        icon={CircleAlert}
        title="No pudimos cargar esta sección"
      />
    )
  }

  if (requestState === "forbidden") {
    return (
      <EmptyState
        description="Tu cuenta no tiene permisos para administrar esta sección de la plataforma."
        icon={ShieldX}
        title="Acceso restringido"
      />
    )
  }

  if (!remote) {
    return <PageLoading className="min-h-80" />
  }

  function openCreateSheet() {
    setFormValues(primaryAction?.fields.map(() => "") ?? [])
    setEditingRowId(null)
    setDialogOpen(true)
  }

  function changeTab(value: string) {
    setActiveTab(value)
    setSearch("")
    setStatus("all")
    setPageIndex(0)
    setFormValues([])
    setRemote(null)
    setRequestState("loading")
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {moduleConfig.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {moduleConfig.description}
        </p>
      </header>

      {moduleConfig.tabs.length > 1 ? (
        <Tabs onValueChange={changeTab} value={activeTab}>
          <TabsList aria-label={`Secciones de ${moduleConfig.title}`}>
            {moduleConfig.tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <CardGrid>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </CardGrid>

      <Card variant="subtle">
        <DataTableHeader
          action={
            primaryAction && PrimaryIcon ? (
              <Button
                className="hidden sm:inline-flex"
                disabled={saving}
                onClick={openCreateSheet}
                size="sm"
              >
                <PrimaryIcon aria-hidden="true" data-icon="inline-start" />
                {primaryAction.label}
              </Button>
            ) : undefined
          }
          search={{
            ariaLabel: `Buscar en ${active.label}`,
            onChange: (value) => {
              setSearch(value)
              setPageIndex(0)
            },
            placeholder: active.searchPlaceholder,
            value: search,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <DataTableToolbar>
            <DataTableFilter
              ariaLabel="Filtrar por estado"
              label="Estado"
              onValueChange={(value) => {
                setStatus(value)
                setPageIndex(0)
              }}
              options={[
                { label: "Todos los estados", value: "all" },
                ...statuses.map((item) => ({ label: item, value: item })),
              ]}
              value={status}
            />
          </DataTableToolbar>
          <Table>
            <TableHeader>
              <TableRow>
                {active.columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row) => (
                <TableRow key={row.id}>
                  {row.cells.map((cell, index) => (
                    <TableCell
                      key={`${row.id}-${active.columns[index] ?? index}`}
                    >
                      <div className="grid gap-0.5">
                        <span
                          className={
                            cell.mono ? "font-mono text-xs" : "font-medium"
                          }
                        >
                          {cell.primary}
                        </span>
                        {cell.secondary ? (
                          <span className="text-xs text-muted-foreground">
                            {cell.secondary}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell>
                    <StatusBadge label={row.status} tone={row.tone} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label={`Acciones para ${row.cells[0]?.primary ?? row.id}`}
                          size="icon-sm"
                          variant="brand-secondary"
                        >
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.actions.map((action, index) => (
                          <React.Fragment key={action.label}>
                            {action.kind === "destructive" && index > 0 ? (
                              <DropdownMenuSeparator />
                            ) : null}
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                disabled={saving}
                                variant={
                                  action.kind === "destructive"
                                    ? "destructive"
                                    : undefined
                                }
                                onSelect={() => {
                                  if (!action.key) return
                                  if (action.kind === "destructive") {
                                    setPendingDestructive({
                                      action: action.label,
                                      actionKey: action.key,
                                      id: row.id,
                                      resource: row.cells[0]?.primary ?? row.id,
                                    })
                                    return
                                  }
                                  if (action.key === "view") {
                                    if (
                                      moduleKey === "affiliate" &&
                                      action.label === "Ver comisiones"
                                    ) {
                                      setActiveTab("commissions")
                                      setSearch(row.cells[0]?.primary ?? "")
                                      setPageIndex(0)
                                      return
                                    }
                                    setDetailRow(row)
                                    return
                                  }
                                  if (action.key === "edit" && primaryAction) {
                                    setEditingRowId(row.id)
                                    setFormValues(
                                      editValuesFor(
                                        moduleKey,
                                        row,
                                        primaryAction.fields.length
                                      )
                                    )
                                    setDialogOpen(true)
                                    return
                                  }
                                  setSaving(true)
                                  void adminOperationsApi
                                    .action(
                                      moduleKey,
                                      activeTab,
                                      row.id,
                                      action.key
                                    )
                                    .then((result) => {
                                      toast.success(result.message)
                                      setRefreshKey((current) => current + 1)
                                    })
                                    .catch(() =>
                                      toast.error(
                                        "No se pudo aplicar la acción."
                                      )
                                    )
                                    .finally(() => setSaving(false))
                                }}
                              >
                                <RowActionIcon action={action} index={index} />
                                {action.label}
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </React.Fragment>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableEmptyRow
                  colSpan={active.columns.length + 2}
                  description={
                    search || status !== "all"
                      ? "Prueba con otro término o restablece los filtros."
                      : `Todavía no hay ${active.label.toLowerCase()} en esta sección.`
                  }
                  title={
                    search || status !== "all"
                      ? `No encontramos ${active.label.toLowerCase()}`
                      : `Aún no hay ${active.label.toLowerCase()}`
                  }
                />
              ) : null}
            </TableBody>
          </Table>
          <TablePagination
            canGoNext={currentPageIndex < pageCount - 1}
            canGoPrevious={currentPageIndex > 0}
            itemLabel={active.label.toLowerCase()}
            onNextPage={() =>
              setPageIndex((current) => Math.min(current + 1, pageCount - 1))
            }
            onPreviousPage={() =>
              setPageIndex((current) => Math.max(current - 1, 0))
            }
            rangeEnd={rangeEnd}
            rangeStart={rangeStart}
            total={total}
          />
        </CardContent>
      </Card>

      {primaryAction && PrimaryIcon ? (
        <FloatingActionButton
          disabled={saving}
          icon={<PrimaryIcon aria-hidden="true" className="size-6" />}
          label={primaryAction.label}
          onClick={openCreateSheet}
        />
      ) : null}

      {primaryAction ? (
        <Sheet
          onOpenChange={(open) => {
            if (!saving) setDialogOpen(open)
          }}
          open={dialogOpen}
        >
          <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
            <form
              className="flex min-h-0 flex-1 flex-col"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                if (!formComplete) {
                  toast.error("Completa todos los campos obligatorios.")
                  return
                }
                setSaving(true)
                const operation = editingRowId
                  ? adminOperationsApi.action(
                      moduleKey,
                      activeTab,
                      editingRowId,
                      "edit",
                      formValues
                    )
                  : adminOperationsApi.create(moduleKey, formValues)
                void operation
                  .then((result) => {
                    setDialogOpen(false)
                    setEditingRowId(null)
                    toast.success(result.message)
                    setRefreshKey((current) => current + 1)
                  })
                  .catch(() =>
                    toast.error("No se pudieron guardar los cambios.")
                  )
                  .finally(() => setSaving(false))
              }}
            >
              <SheetHeader className="border-b pr-12">
                <SheetTitle>{primaryAction.dialogTitle}</SheetTitle>
                <SheetDescription>
                  {primaryAction.dialogDescription}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <FieldGroup>
                  {primaryAction.fields.map((field, index) => (
                    <Field key={field}>
                      <RequiredLabel>{field}</RequiredLabel>
                      <Input
                        aria-required="true"
                        name={`field-${index}`}
                        onChange={(event) =>
                          setFormValues((current) =>
                            current.map((value, valueIndex) =>
                              valueIndex === index ? event.target.value : value
                            )
                          )
                        }
                        placeholder={field}
                        value={formValues[index] ?? ""}
                      />
                    </Field>
                  ))}
                </FieldGroup>
              </div>
              <SheetFooter className="flex-row justify-end border-t">
                <Button
                  disabled={saving}
                  onClick={() => setDialogOpen(false)}
                  type="button"
                  variant="brand-secondary"
                >
                  Cancelar
                </Button>
                <Button disabled={!formComplete || saving} type="submit">
                  {saving ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Plus aria-hidden="true" data-icon="inline-start" />
                  )}
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      ) : null}

      <Sheet
        onOpenChange={(open) => !open && setDetailRow(null)}
        open={detailRow !== null}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{detailRow?.cells[0]?.primary ?? "Detalle"}</SheetTitle>
            <SheetDescription>
              Información registrada en esta sección administrativa.
            </SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4">
            {detailRow?.cells.map((cell, index) => (
              <div className="grid gap-0.5" key={`${cell.primary}-${index}`}>
                <span className="text-xs text-muted-foreground">
                  {active.columns[index] ?? `Campo ${index + 1}`}
                </span>
                <span className={cell.mono ? "font-mono text-sm" : "text-sm"}>
                  {cell.primary}
                </span>
                {cell.secondary ? (
                  <span className="text-xs text-muted-foreground">
                    {cell.secondary}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              onClick={() => setDetailRow(null)}
              variant="brand-secondary"
            >
              Cerrar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !saving) setPendingDestructive(null)
        }}
        open={pendingDestructive !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acción</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDestructive
                ? `${pendingDestructive.action} sobre ${pendingDestructive.resource}. Esta acción quedará registrada en auditoría.`
                : "Confirma la acción seleccionada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} variant="brand-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault()
                const pending = pendingDestructive
                if (!pending || saving) return
                setSaving(true)
                void adminOperationsApi
                  .action(moduleKey, activeTab, pending.id, pending.actionKey)
                  .then((result) => {
                    toast.success(result.message)
                    setRefreshKey((current) => current + 1)
                    setPendingDestructive(null)
                  })
                  .catch(() => toast.error("No se pudo aplicar la acción."))
                  .finally(() => setSaving(false))
              }}
              variant="destructive"
            >
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              {saving ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
