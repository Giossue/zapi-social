"use client"

import type { FormEvent, ReactNode } from "react"

import {
  CircleAlert,
  Clock3,
  Coins,
  Download,
  EllipsisVertical,
  FileSearch,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Trash2,
} from "lucide-react"

import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Textarea } from "@workspace/ui/components/textarea"
import { TimePicker } from "@workspace/ui/components/time-picker"

const historyStatusOptions = [
  { label: "Todos los estados", value: "all" },
  { label: "En cola", value: "queued" },
  { label: "Procesando", value: "processing" },
  { label: "Completados", value: "succeeded" },
  { label: "Fallidos", value: "failed" },
  { label: "Cancelados", value: "cancelled" },
] as const

const historyKindOptions = [
  { label: "Todas las herramientas", value: "all" },
  { label: "Contenido", value: "content" },
  { label: "Imagen", value: "image" },
  { label: "Video", value: "video" },
  { label: "Reutilizar", value: "repurpose" },
  { label: "Planificador", value: "planner" },
  { label: "Revisión", value: "review" },
  { label: "Mejor hora", value: "timing" },
  { label: "Investigación", value: "search" },
  { label: "Publicación AI", value: "ai_publishing" },
] as const

const automationStatusOptions = [
  { label: "Todos los estados", value: "all" },
  { label: "Activas", value: "active" },
  { label: "Pausadas", value: "paused" },
  { label: "Borradores", value: "draft" },
] as const

const creditTypeOptions = [
  { label: "Todos los movimientos", value: "all" },
  { label: "Asignaciones", value: "grant" },
  { label: "Consumos", value: "debit" },
  { label: "Reembolsos", value: "refund" },
  { label: "Ajustes", value: "adjustment" },
] as const

type AiOperationalViewState = "loading" | "ready" | "error" | "forbidden"
type AiHistoryStatus =
  "queued" | "processing" | "succeeded" | "failed" | "cancelled"
type AiAutomationStatus = "draft" | "active" | "paused"
type AiCreditMovementType = "grant" | "debit" | "refund" | "adjustment"

type AiHistoryRow = {
  id: string
  title: string
  subtitle: string
  kind: string
  status: AiHistoryStatus
  cost: string
  date: string
}

type AiAutomationRow = {
  id: string
  name: string
  cadence: string
  nextRun: string
  status: AiAutomationStatus
}

type AiAccountOption = {
  id: string
  label: string
}

type AiCreditMovementRow = {
  id: string
  date: string
  type: AiCreditMovementType
  detail: string
  credits: string
}

type AiToolCost = {
  id: string
  label: string
  cost: string
}

type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onNextPage: () => void
  onPreviousPage: () => void
}

type CollectionStateProps = {
  state: AiOperationalViewState
  children: ReactNode
  errorDescription: string
  forbiddenDescription: string
  onRetry: () => void
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function OperationsHeader({
  actions,
  description,
  title,
}: {
  actions?: ReactNode
  description: string
  title: string
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}

function CollectionState({
  children,
  errorDescription,
  forbiddenDescription,
  onRetry,
  state,
}: CollectionStateProps) {
  if (state === "loading") {
    return <PageLoading aria-label="Cargando registros" />
  }

  if (state === "error") {
    return (
      <EmptyState
        action={
          <Button onClick={onRetry} type="button" variant="brand-secondary">
            <RefreshCw aria-hidden="true" data-icon="inline-start" />
            Reintentar
          </Button>
        }
        description={errorDescription}
        icon={CircleAlert}
        title="No pudimos cargar esta información"
      />
    )
  }

  if (state === "forbidden") {
    return (
      <EmptyState
        description={forbiddenDescription}
        icon={ShieldX}
        title="No tienes permiso para ver esta información"
      />
    )
  }

  return children
}

function CollectionPagination({
  onNextPage,
  onPreviousPage,
  page,
  pageSize,
  total,
}: PaginationProps) {
  return (
    <TablePagination
      canGoNext={page * pageSize < total}
      canGoPrevious={page > 1}
      itemLabel="registros"
      onNextPage={onNextPage}
      onPreviousPage={onPreviousPage}
      rangeEnd={Math.min(page * pageSize, total)}
      rangeStart={total ? (page - 1) * pageSize + 1 : 0}
      total={total}
    />
  )
}

function HistoryStatusBadge({ status }: { status: AiHistoryStatus }) {
  const label = {
    cancelled: "Cancelado",
    failed: "Falló",
    processing: "Procesando",
    queued: "En cola",
    succeeded: "Completado",
  }[status]

  if (status === "succeeded") return <Badge variant="success">{label}</Badge>
  if (status === "failed") return <Badge variant="destructive">{label}</Badge>
  return <Badge variant="secondary">{label}</Badge>
}

function AutomationStatusBadge({ status }: { status: AiAutomationStatus }) {
  if (status === "active") return <Badge variant="success">Activa</Badge>
  if (status === "paused") return <Badge variant="warning">Pausada</Badge>
  return <Badge variant="secondary">Borrador</Badge>
}

function CreditTypeBadge({ type }: { type: AiCreditMovementType }) {
  const label = {
    adjustment: "Ajuste",
    debit: "Consumo",
    grant: "Asignación",
    refund: "Reembolso",
  }[type]

  if (type === "grant" || type === "refund")
    return <Badge variant="success">{label}</Badge>
  if (type === "debit") return <Badge variant="warning">{label}</Badge>
  return <Badge variant="info">{label}</Badge>
}

type AiHistorySurfaceProps = PaginationProps & {
  action?: ReactNode
  hasFilters: boolean
  kindFilter: string
  onClearFilters: () => void
  onKindFilterChange: (value: string) => void
  onQueryChange: (value: string) => void
  onRetry: () => void
  onStatusFilterChange: (value: string) => void
  query: string
  renderActions: (row: AiHistoryRow) => ReactNode
  rows: AiHistoryRow[]
  state: AiOperationalViewState
  statusFilter: string
}

function AiHistorySurface({
  action,
  hasFilters,
  kindFilter,
  onClearFilters,
  onKindFilterChange,
  onNextPage,
  onPreviousPage,
  onQueryChange,
  onRetry,
  onStatusFilterChange,
  page,
  pageSize,
  query,
  renderActions,
  rows,
  state,
  statusFilter,
  total,
}: AiHistorySurfaceProps) {
  return (
    <div className="flex flex-col gap-6">
      <OperationsHeader
        description="Encuentra, reutiliza y descarga cualquier generación anterior."
        title="Historial de IA"
      />
      <CollectionHeader
        description="Resultados creados dentro de este espacio de trabajo."
        level="h2"
        title="Generaciones"
      />
      <Card variant="subtle">
        <DataTableHeader
          action={action}
          search={{
            ariaLabel: "Buscar generaciones",
            onChange: onQueryChange,
            placeholder: "Buscar generaciones...",
            value: query,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <DataTableToolbar>
            <DataTableFilter
              ariaLabel="Filtrar historial por estado"
              label="Estado"
              onValueChange={onStatusFilterChange}
              options={historyStatusOptions}
              value={statusFilter}
            />
            <DataTableFilter
              ariaLabel="Filtrar historial por herramienta"
              label="Herramienta"
              onValueChange={onKindFilterChange}
              options={historyKindOptions}
              value={kindFilter}
            />
          </DataTableToolbar>

          <CollectionState
            errorDescription="El historial no respondió. Puedes volver a intentarlo sin perder tus filtros."
            forbiddenDescription="Tu rol no permite consultar el historial de IA de este espacio."
            onRetry={onRetry}
            state={state}
          >
            {rows.length ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Generación</TableHead>
                      <TableHead>Herramienta</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Consumo</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{row.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {row.subtitle}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{row.kind}</TableCell>
                        <TableCell>
                          <HistoryStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell>{row.cost}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.date}
                        </TableCell>
                        <TableCell className="text-right">
                          {renderActions(row)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <CollectionPagination
                  onNextPage={onNextPage}
                  onPreviousPage={onPreviousPage}
                  page={page}
                  pageSize={pageSize}
                  total={total}
                />
              </>
            ) : (
              <EmptyState
                action={
                  hasFilters ? (
                    <Button
                      onClick={onClearFilters}
                      type="button"
                      variant="brand-secondary"
                    >
                      Limpiar filtros
                    </Button>
                  ) : undefined
                }
                description={
                  hasFilters
                    ? "Ajusta la búsqueda, el estado o la herramienta seleccionada."
                    : "Las nuevas generaciones aparecerán aquí cuando uses AI Studio."
                }
                icon={FileSearch}
                title={
                  hasFilters ? "Sin resultados" : "Aún no hay generaciones"
                }
              />
            )}
          </CollectionState>
        </CardContent>
      </Card>
    </div>
  )
}

type AiAutomationSurfaceProps = PaginationProps & {
  accountId: string
  accounts: AiAccountOption[]
  busyRowId: string | null
  canManage: boolean
  deleting: boolean
  formOpen: boolean
  hasFilters: boolean
  name: string
  onAccountIdChange: (value: string) => void
  onClearFilters: () => void
  onConfirmDelete: () => void
  onDeleteOpenChange: (open: boolean) => void
  onNameChange: (value: string) => void
  onPromptChange: (value: string) => void
  onQueryChange: (value: string) => void
  onRequestDelete: (row: AiAutomationRow) => void
  onRetry: () => void
  onRun: (row: AiAutomationRow) => void
  onStatusFilterChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTimeChange: (value: string) => void
  onToggle: (row: AiAutomationRow, checked: boolean) => void
  onToggleForm: () => void
  pendingCreate: boolean
  pendingDelete: AiAutomationRow | null
  prompt: string
  query: string
  rows: AiAutomationRow[]
  state: AiOperationalViewState
  statusFilter: string
  time: string
}

function AiAutomationSurface({
  accountId,
  accounts,
  busyRowId,
  canManage,
  deleting,
  formOpen,
  hasFilters,
  name,
  onAccountIdChange,
  onClearFilters,
  onConfirmDelete,
  onDeleteOpenChange,
  onNameChange,
  onNextPage,
  onPreviousPage,
  onPromptChange,
  onQueryChange,
  onRequestDelete,
  onRetry,
  onRun,
  onStatusFilterChange,
  onSubmit,
  onTimeChange,
  onToggle,
  onToggleForm,
  page,
  pageSize,
  pendingCreate,
  pendingDelete,
  prompt,
  query,
  rows,
  state,
  statusFilter,
  time,
  total,
}: AiAutomationSurfaceProps) {
  const canSubmit = Boolean(name.trim() && prompt.trim() && time && accountId)
  let emptyDescription =
    "Conecta primero una cuenta social para elegir un destino."

  if (accounts.length)
    emptyDescription =
      "Crea una regla para producir borradores automáticamente."
  if (!canManage)
    emptyDescription = "No hay automatizaciones disponibles para consultar."
  if (hasFilters) emptyDescription = "Ajusta la búsqueda o el filtro de estado."

  return (
    <div className="flex flex-col gap-6">
      <OperationsHeader
        actions={
          canManage ? (
            <Button
              disabled={state !== "ready"}
              onClick={onToggleForm}
              type="button"
            >
              <Plus aria-hidden="true" data-icon="inline-start" />
              Nueva automatización
            </Button>
          ) : undefined
        }
        description="Crea reglas que generan borradores listos para revisión humana."
        title="Automatizaciones"
      />

      {formOpen && canManage ? (
        <form className="flex flex-col gap-3" noValidate onSubmit={onSubmit}>
          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Nueva automatización</CardTitle>
              <CardDescription>
                Genera borradores; nunca publica sin revisión humana.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FieldGroup className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="automation-name">
                      Nombre <RequiredMark />
                    </FieldLabel>
                    <Input
                      aria-required="true"
                      id="automation-name"
                      onChange={(event) => onNameChange(event.target.value)}
                      value={name}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="automation-time">
                      Hora <RequiredMark />
                    </FieldLabel>
                    <TimePicker
                      aria-required={true}
                      id="automation-time"
                      onValueChange={onTimeChange}
                      value={time}
                    />
                  </Field>
                </FieldGroup>
                <Field>
                  <FieldLabel htmlFor="automation-prompt">
                    Instrucción <RequiredMark />
                  </FieldLabel>
                  <Textarea
                    aria-required="true"
                    id="automation-prompt"
                    onChange={(event) => onPromptChange(event.target.value)}
                    rows={4}
                    value={prompt}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="automation-account">
                    Cuenta de destino <RequiredMark />
                  </FieldLabel>
                  <Select onValueChange={onAccountIdChange} value={accountId}>
                    <SelectTrigger
                      aria-required="true"
                      className="w-full"
                      id="automation-account"
                    >
                      <SelectValue placeholder="Selecciona una cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {accounts.length === 0 ? (
                    <FieldDescription>
                      Conecta una cuenta social para crear automatizaciones.
                    </FieldDescription>
                  ) : null}
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button disabled={pendingCreate || !canSubmit} type="submit">
              {pendingCreate ? (
                <Spinner
                  aria-label="Guardando automatización"
                  data-icon="inline-start"
                />
              ) : (
                <Save aria-hidden="true" data-icon="inline-start" />
              )}
              {pendingCreate ? "Guardando..." : "Guardar automatización"}
            </Button>
          </div>
        </form>
      ) : null}

      <CollectionHeader
        description="Reglas que crean borradores y conservan la aprobación final en una persona."
        level="h2"
        title="Reglas"
      />
      <Card variant="subtle">
        <DataTableHeader
          search={{
            ariaLabel: "Buscar automatizaciones",
            onChange: onQueryChange,
            placeholder: "Buscar automatizaciones...",
            value: query,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <DataTableToolbar>
            <DataTableFilter
              ariaLabel="Filtrar automatizaciones por estado"
              label="Estado"
              onValueChange={onStatusFilterChange}
              options={automationStatusOptions}
              value={statusFilter}
            />
          </DataTableToolbar>

          <CollectionState
            errorDescription="Las automatizaciones no respondieron. Inténtalo de nuevo para recuperar la lista."
            forbiddenDescription="Tu rol no permite consultar ni administrar automatizaciones de este espacio."
            onRetry={onRetry}
            state={state}
          >
            {rows.length ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Automatización</TableHead>
                      <TableHead>Frecuencia</TableHead>
                      <TableHead>Próxima ejecución</TableHead>
                      <TableHead>Estado</TableHead>
                      {canManage ? (
                        <TableHead className="text-right">Acciones</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const busy = busyRowId === row.id

                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell>{row.cadence}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.nextRun}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AutomationStatusBadge status={row.status} />
                              {canManage ? (
                                <Switch
                                  aria-label={`Activar ${row.name}`}
                                  checked={row.status === "active"}
                                  disabled={busy}
                                  onCheckedChange={(checked) =>
                                    onToggle(row, checked)
                                  }
                                />
                              ) : null}
                            </div>
                          </TableCell>
                          {canManage ? (
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    aria-label={`Acciones para ${row.name}`}
                                    disabled={busy}
                                    size="icon-sm"
                                    variant="brand-secondary"
                                  >
                                    {busy ? (
                                      <Spinner aria-label="Procesando acción" />
                                    ) : (
                                      <EllipsisVertical aria-hidden="true" />
                                    )}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuGroup>
                                    <DropdownMenuItem
                                      onSelect={() => onRun(row)}
                                    >
                                      <Play aria-hidden="true" />
                                      Ejecutar ahora
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuGroup>
                                    <DropdownMenuItem
                                      onSelect={() => onRequestDelete(row)}
                                      variant="destructive"
                                    >
                                      <Trash2 aria-hidden="true" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <CollectionPagination
                  onNextPage={onNextPage}
                  onPreviousPage={onPreviousPage}
                  page={page}
                  pageSize={pageSize}
                  total={total}
                />
              </>
            ) : (
              <EmptyState
                action={
                  hasFilters ? (
                    <Button
                      onClick={onClearFilters}
                      type="button"
                      variant="brand-secondary"
                    >
                      Limpiar filtros
                    </Button>
                  ) : undefined
                }
                description={emptyDescription}
                icon={Sparkles}
                title={
                  hasFilters ? "Sin resultados" : "Aún no hay automatizaciones"
                }
              />
            )}
          </CollectionState>
        </CardContent>
      </Card>

      <Alert>
        <ShieldCheck aria-hidden="true" />
        <AlertTitle>Aprobación humana activa</AlertTitle>
        <AlertDescription>
          Ninguna automatización publica directamente. Todos los resultados
          llegan como borrador.
        </AlertDescription>
      </Alert>

      <AlertDialog
        onOpenChange={onDeleteOpenChange}
        open={pendingDelete !== null}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta automatización?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará “{pendingDelete?.name ?? "esta automatización"}”. Los
              borradores ya creados se conservarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} variant="brand-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault()
                onConfirmDelete()
              }}
              variant="destructive"
            >
              {deleting ? (
                <Spinner
                  aria-label="Eliminando automatización"
                  data-icon="inline-start"
                />
              ) : (
                <Trash2 aria-hidden="true" data-icon="inline-start" />
              )}
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type AiCreditsSurfaceProps = PaginationProps & {
  alertPercent: string
  alertsEnabled: boolean
  balance: string
  budget: string
  budgetEditable: boolean
  consumed: string
  hasFilters: boolean
  movementType: string
  movements: AiCreditMovementRow[]
  onAlertPercentChange: (value: string) => void
  onAlertsEnabledChange: (value: boolean) => void
  onBudgetChange: (value: string) => void
  onClearFilters: () => void
  onMovementTypeChange: (value: string) => void
  onQueryChange: (value: string) => void
  onRetry: () => void
  onSaveBudget: (event: FormEvent<HTMLFormElement>) => void
  pendingBudget: boolean
  query: string
  renewal: string
  state: AiOperationalViewState
  tableAction?: ReactNode
  toolCosts: AiToolCost[]
}

function AiCreditsSurface({
  alertPercent,
  alertsEnabled,
  balance,
  budget,
  budgetEditable,
  consumed,
  hasFilters,
  movementType,
  movements,
  onAlertPercentChange,
  onAlertsEnabledChange,
  onBudgetChange,
  onClearFilters,
  onMovementTypeChange,
  onNextPage,
  onPreviousPage,
  onQueryChange,
  onRetry,
  onSaveBudget,
  page,
  pageSize,
  pendingBudget,
  query,
  renewal,
  state,
  tableAction,
  toolCosts,
  total,
}: AiCreditsSurfaceProps) {
  const alertNumber = Number(alertPercent)
  const budgetNumber = Number(budget)
  const budgetIsValid =
    budget === "" || (Number.isFinite(budgetNumber) && budgetNumber >= 0)
  const alertIsValid =
    alertPercent.trim() !== "" &&
    Number.isFinite(alertNumber) &&
    alertNumber >= 1 &&
    alertNumber <= 100

  return (
    <div className="flex flex-col gap-6">
      <OperationsHeader
        description="Entiende el consumo de IA y controla el presupuesto de tu espacio de trabajo."
        title="Créditos y consumo"
      />

      {state === "ready" ? (
        <>
          <CardGrid layout="xl-3">
            {[
              {
                description: "créditos",
                icon: Coins,
                label: "Saldo disponible",
                value: balance,
              },
              {
                description: "en el ciclo",
                icon: Sparkles,
                label: "Consumidos",
                value: consumed,
              },
              {
                description: "ciclo actual",
                icon: Clock3,
                label: "Próxima renovación",
                value: renewal,
              },
            ].map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </CardGrid>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex flex-col gap-4">
              <CollectionHeader
                description="Asignaciones, consumos, reembolsos y ajustes del espacio."
                level="h2"
                title="Movimientos"
              />
              <Card variant="subtle">
                <DataTableHeader
                  action={tableAction}
                  search={{
                    ariaLabel: "Buscar movimientos de créditos",
                    onChange: onQueryChange,
                    placeholder: "Buscar movimientos...",
                    value: query,
                  }}
                />
                <CardContent className="flex flex-col gap-4 px-0">
                  <DataTableToolbar>
                    <DataTableFilter
                      ariaLabel="Filtrar movimientos por tipo"
                      label="Tipo"
                      onValueChange={onMovementTypeChange}
                      options={creditTypeOptions}
                      value={movementType}
                    />
                  </DataTableToolbar>

                  {movements.length ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Movimiento</TableHead>
                            <TableHead>Detalle</TableHead>
                            <TableHead className="text-right">
                              Créditos
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {movements.map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell className="text-muted-foreground">
                                {movement.date}
                              </TableCell>
                              <TableCell>
                                <CreditTypeBadge type={movement.type} />
                              </TableCell>
                              <TableCell>{movement.detail}</TableCell>
                              <TableCell className="text-right font-medium">
                                {movement.credits}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <CollectionPagination
                        onNextPage={onNextPage}
                        onPreviousPage={onPreviousPage}
                        page={page}
                        pageSize={pageSize}
                        total={total}
                      />
                    </>
                  ) : (
                    <EmptyState
                      action={
                        hasFilters ? (
                          <Button
                            onClick={onClearFilters}
                            type="button"
                            variant="brand-secondary"
                          >
                            Limpiar filtros
                          </Button>
                        ) : undefined
                      }
                      description={
                        hasFilters
                          ? "Ajusta la búsqueda o el tipo de movimiento."
                          : "Los movimientos aparecerán cuando se asignen o consuman créditos."
                      }
                      icon={FileSearch}
                      title={
                        hasFilters ? "Sin resultados" : "Aún no hay movimientos"
                      }
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card variant="subtle">
                <CardHeader>
                  <CardTitle>Presupuesto mensual</CardTitle>
                  <CardDescription>
                    {budgetEditable
                      ? "Vacío significa sin límite monetario."
                      : "Solo propietarios y administradores pueden cambiar este presupuesto."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form noValidate onSubmit={onSaveBudget}>
                    <FieldGroup>
                      <Field data-disabled={!budgetEditable || pendingBudget}>
                        <FieldLabel htmlFor="ai-monthly-budget">
                          Límite USD
                        </FieldLabel>
                        <Input
                          disabled={!budgetEditable || pendingBudget}
                          id="ai-monthly-budget"
                          min="0"
                          onChange={(event) =>
                            onBudgetChange(event.target.value)
                          }
                          step="0.01"
                          type="number"
                          value={budget}
                        />
                      </Field>
                      <Field data-disabled={!budgetEditable || pendingBudget}>
                        <FieldLabel htmlFor="ai-budget-alert">
                          Alerta al % <RequiredMark />
                        </FieldLabel>
                        <Input
                          aria-required="true"
                          disabled={!budgetEditable || pendingBudget}
                          id="ai-budget-alert"
                          max="100"
                          min="1"
                          onChange={(event) =>
                            onAlertPercentChange(event.target.value)
                          }
                          type="number"
                          value={alertPercent}
                        />
                      </Field>
                      <Field
                        data-disabled={!budgetEditable || pendingBudget}
                        orientation="horizontal"
                      >
                        <FieldLabel htmlFor="ai-budget-alerts">
                          Alertas activas
                        </FieldLabel>
                        <Switch
                          checked={alertsEnabled}
                          disabled={!budgetEditable || pendingBudget}
                          id="ai-budget-alerts"
                          onCheckedChange={onAlertsEnabledChange}
                        />
                      </Field>
                      <Button
                        disabled={
                          !budgetEditable ||
                          pendingBudget ||
                          !budgetIsValid ||
                          !alertIsValid
                        }
                        type="submit"
                      >
                        {pendingBudget ? (
                          <Spinner
                            aria-label="Guardando presupuesto"
                            data-icon="inline-start"
                          />
                        ) : (
                          <Save aria-hidden="true" data-icon="inline-start" />
                        )}
                        {pendingBudget ? "Guardando..." : "Guardar presupuesto"}
                      </Button>
                    </FieldGroup>
                  </form>
                </CardContent>
              </Card>

              <Card variant="subtle">
                <CardHeader>
                  <CardTitle>Costo por herramienta</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {toolCosts.map((tool) => (
                    <div
                      className="flex items-center justify-between gap-3 text-sm"
                      key={tool.id}
                    >
                      <span className="text-muted-foreground">
                        {tool.label}
                      </span>
                      <Badge variant="warning">{tool.cost}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <Card variant="subtle">
          <CollectionState
            errorDescription="No pudimos recuperar el saldo ni los movimientos de créditos."
            forbiddenDescription="Tu rol no permite consultar el consumo de IA de este espacio."
            onRetry={onRetry}
            state={state}
          >
            {null}
          </CollectionState>
        </Card>
      )}
    </div>
  )
}

function DownloadTableButton({
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      size="sm"
      type="button"
      variant="brand-secondary"
    >
      <Download aria-hidden="true" data-icon="inline-start" />
      {label}
    </Button>
  )
}

export {
  type AiAccountOption,
  type AiAutomationRow,
  AiAutomationSurface,
  type AiCreditMovementRow,
  AiCreditsSurface,
  type AiHistoryRow,
  AiHistorySurface,
  type AiOperationalViewState,
  type AiToolCost,
  DownloadTableButton,
}
