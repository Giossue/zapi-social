"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  BadgeDollarSign,
  Check,
  CircleAlert,
  CircleDot,
  Landmark,
  Plus,
  Save,
  ShieldX,
  Trash2,
  X,
} from "lucide-react"

import { adminManualPaymentsApi, ApiError } from "@workspace/api-client"
import type {
  AdminManualPayment,
  AdminManualPaymentMetrics,
  AdminManualPaymentOptions,
  CreateAdminManualPaymentInput,
  ManualPaymentSettings,
  ManualPaymentStatus,
} from "@workspace/contracts"
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
import { Card, CardContent } from "@workspace/ui/components/card"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
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
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

const statusLabel: Record<ManualPaymentStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
}

const statusVariant: Record<
  ManualPaymentStatus,
  "info" | "success" | "secondary"
> = { pending: "info", approved: "success", rejected: "secondary" }

const emptyMetrics: AdminManualPaymentMetrics = {
  pending: 0,
  approved: 0,
  rejected: 0,
  approvedAmountMinor: 0,
  currency: "USD",
}

const emptySettings: ManualPaymentSettings = {
  enabled: false,
  referencePrefix: "PAY-",
  instructions: "",
}

const emptyOptions: AdminManualPaymentOptions = {
  workspaces: [],
  plans: [],
  creditPackages: [],
}

const pageSize = 10

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("es-EC", { currency, style: "currency" }).format(
    minor / 100
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

type FormValues = {
  workspaceId: string
  productType: "plan" | "credits"
  productId: string
  amount: string
  reference: string
  paymentInfo: string
  note: string
}

const emptyForm: FormValues = {
  workspaceId: "",
  productType: "plan",
  productId: "",
  amount: "",
  reference: "",
  paymentInfo: "",
  note: "",
}

function ManualPaymentSheet({
  onOpenChange,
  onSubmit,
  open,
  options,
  onSearchWorkspaces,
  pending,
  prefix,
}: {
  onOpenChange: (open: boolean) => void
  onSearchWorkspaces: (q: string) => void
  onSubmit: (values: CreateAdminManualPaymentInput) => Promise<boolean>
  open: boolean
  options: AdminManualPaymentOptions
  pending: boolean
  prefix: string
}) {
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [workspaceQuery, setWorkspaceQuery] = useState("")

  useEffect(() => {
    if (open) {
      setValues({ ...emptyForm, reference: prefix })
      setWorkspaceQuery("")
    }
  }, [open, prefix])

  useEffect(() => {
    const timer = setTimeout(
      () => onSearchWorkspaces(workspaceQuery.trim()),
      workspaceQuery ? 300 : 0
    )
    return () => clearTimeout(timer)
  }, [onSearchWorkspaces, workspaceQuery])

  const catalog =
    values.productType === "plan" ? options.plans : options.creditPackages
  const canSubmit = Boolean(
    values.workspaceId &&
      values.productId &&
      values.reference.trim() &&
      Number(values.amount) > 0
  )

  function close() {
    setValues(emptyForm)
    onOpenChange(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error("Completa todos los campos obligatorios.")
      return
    }
    const created = await onSubmit({
      workspaceId: values.workspaceId,
      productType: values.productType,
      planId: values.productType === "plan" ? values.productId : null,
      creditPackageId:
        values.productType === "credits" ? values.productId : null,
      amountMinor: Math.round(Number(values.amount) * 100),
      currency: "USD",
      reference: values.reference.trim(),
      paymentInfo: values.paymentInfo.trim(),
      note: values.note.trim(),
    })
    if (created) close()
  }

  return (
    <Sheet onOpenChange={(next) => (next ? onOpenChange(true) : close())} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>Registrar pago manual</SheetTitle>
          <SheetDescription>
            Queda pendiente hasta que lo apruebes. Al aprobarlo se concede el
            plan o los créditos y se registra el cobro.
          </SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="manual-workspace">
                  Espacio de trabajo{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Input
                  aria-label="Buscar espacio de trabajo"
                  onChange={(event) => setWorkspaceQuery(event.target.value)}
                  placeholder="Buscar espacio..."
                  value={workspaceQuery}
                />
                <Select
                  onValueChange={(workspaceId) =>
                    setValues((current) => ({ ...current, workspaceId }))
                  }
                  value={values.workspaceId}
                >
                  <SelectTrigger
                    aria-required="true"
                    className="w-full"
                    id="manual-workspace"
                  >
                    <SelectValue placeholder="Selecciona un espacio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {options.workspaces.map((workspace) => (
                        <SelectItem key={workspace.id} value={workspace.id}>
                          {workspace.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  El pago se atribuye al propietario del espacio.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-product-type">Producto</FieldLabel>
                <Select
                  onValueChange={(productType) =>
                    setValues((current) => ({
                      ...current,
                      productType: productType as "plan" | "credits",
                      productId: "",
                      amount: "",
                    }))
                  }
                  value={values.productType}
                >
                  <SelectTrigger className="w-full" id="manual-product-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="plan">Plan</SelectItem>
                      <SelectItem value="credits">
                        Paquete de créditos
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-product">
                  {values.productType === "plan" ? "Plan" : "Paquete"}{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Select
                  onValueChange={(productId) => {
                    const option = catalog.find((item) => item.id === productId)
                    setValues((current) => ({
                      ...current,
                      productId,
                      amount: option
                        ? String(option.amountMinor / 100)
                        : current.amount,
                    }))
                  }}
                  value={values.productId}
                >
                  <SelectTrigger
                    aria-required="true"
                    className="w-full"
                    id="manual-product"
                  >
                    <SelectValue placeholder="Selecciona una oferta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {catalog.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label} ·{" "}
                          {money(option.amountMinor, option.currency)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-amount">
                  Importe cobrado (USD){" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="manual-amount"
                  inputMode="decimal"
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  value={values.amount}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-reference">
                  Referencia{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="manual-reference"
                  maxLength={190}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      reference: event.target.value,
                    }))
                  }
                  placeholder="PAY-000123"
                  value={values.reference}
                />
                <FieldDescription>
                  Identificador del comprobante. No puede repetirse.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-info">Datos del pago</FieldLabel>
                <Textarea
                  id="manual-info"
                  maxLength={2000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      paymentInfo: event.target.value,
                    }))
                  }
                  placeholder="Banco, número de operación, fecha del depósito..."
                  rows={3}
                  value={values.paymentInfo}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-note">Nota interna</FieldLabel>
                <Textarea
                  id="manual-note"
                  maxLength={2000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Contexto para el equipo."
                  rows={3}
                  value={values.note}
                />
              </Field>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              disabled={pending}
              onClick={close}
              type="button"
              variant="brand-secondary"
            >
              Cancelar
            </Button>
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              Registrar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AdminManualPaymentsPage() {
  const [payments, setPayments] = useState<AdminManualPayment[]>([])
  const [metrics, setMetrics] = useState(emptyMetrics)
  const [settings, setSettings] = useState(emptySettings)
  const [settingsDraft, setSettingsDraft] = useState(emptySettings)
  const [options, setOptions] = useState(emptyOptions)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<ManualPaymentStatus | "all">("all")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState<AdminManualPayment | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const response = await adminManualPaymentsApi.list({
        limit: pageSize,
        page,
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(status === "all" ? {} : { status }),
      })
      setPayments(response.payments)
      setMetrics(response.metrics)
      setSettings(response.settings)
      setSettingsDraft(response.settings)
      setForbidden(false)
      setTotal(response.total)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error("Manual payments request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [page, query, status])

  const searchWorkspaces = useCallback((value: string) => {
    void adminManualPaymentsApi
      .options(value || undefined)
      .then(setOptions)
      .catch((error: unknown) => {
        console.error("Manual payment options request failed", error)
      })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = total ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = total ? rangeStart + payments.length - 1 : 0
  const hasFilters = Boolean(query || status !== "all")
  const settingsChanged =
    settingsDraft.enabled !== settings.enabled ||
    settingsDraft.referencePrefix !== settings.referencePrefix ||
    settingsDraft.instructions !== settings.instructions

  async function run(action: () => Promise<void>, message: string) {
    setPending(true)
    try {
      await action()
      await load()
      toast.success(message)
      return true
    } catch (error) {
      if (error instanceof ApiError && error.code === "MANUAL_PAYMENT_REFERENCE_TAKEN") {
        toast.error("Esa referencia ya está registrada.")
        return false
      }
      console.error("Manual payment action failed", error)
      toast.error("No pudimos completar la acción. Inténtalo de nuevo.")
      return false
    } finally {
      setPending(false)
    }
  }

  if (forbidden) {
    return (
      <EmptyState
        description="Tu cuenta no tiene permisos para administrar los pagos manuales."
        icon={ShieldX}
        title="Acceso restringido"
      />
    )
  }

  if (isLoading && !payments.length && !loadError) {
    return <PageLoading aria-label="Cargando pagos manuales" />
  }

  if (loadError) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description="No fue posible cargar los pagos manuales."
        icon={CircleAlert}
        title="No pudimos cargar esta sección"
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description="Cobros fuera de Polar: transferencias, depósitos y efectivo registrados por el equipo."
          title="Pagos manuales"
        />
        <Tabs defaultValue="payments">
          <TabsList aria-label="Secciones de pagos manuales">
            <TabsTrigger value="payments">Pagos</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>
          <TabsContent className="flex flex-col gap-4" value="payments">
            <CardGrid>
              <MetricCard
                description="Esperan revisión"
                icon={CircleDot}
                label="Pendientes"
                value={metrics.pending}
              />
              <MetricCard
                description="Concedieron plan o créditos"
                icon={Check}
                label="Aprobados"
                value={metrics.approved}
              />
              <MetricCard
                description="Descartados por el equipo"
                icon={X}
                label="Rechazados"
                value={metrics.rejected}
              />
              <MetricCard
                description="Total cobrado fuera de Polar"
                icon={BadgeDollarSign}
                label="Importe aprobado"
                value={money(metrics.approvedAmountMinor, metrics.currency)}
              />
            </CardGrid>
            <Card variant="subtle">
              <DataTableHeader
                action={
                  <Button
                    onClick={() => {
                      searchWorkspaces("")
                      setSheetOpen(true)
                    }}
                    size="sm"
                    type="button"
                  >
                    <Plus data-icon="inline-start" /> Registrar pago
                  </Button>
                }
                search={{
                  ariaLabel: "Buscar pagos manuales",
                  onChange: (value) => {
                    setQuery(value)
                    setPage(1)
                  },
                  placeholder: "Buscar por referencia, cliente o espacio...",
                  value: query,
                }}
              />
              <CardContent className="flex flex-col gap-4 px-0">
                <DataTableToolbar
                  actions={
                    hasFilters ? (
                      <Button
                        onClick={() => {
                          setQuery("")
                          setStatus("all")
                          setPage(1)
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <X /> Limpiar
                      </Button>
                    ) : undefined
                  }
                >
                  <DataTableFilter
                    ariaLabel="Filtrar por estado"
                    label="Estado"
                    onValueChange={(value) => {
                      setStatus(value as ManualPaymentStatus | "all")
                      setPage(1)
                    }}
                    options={[
                      { label: "Todos", value: "all" },
                      { label: "Pendientes", value: "pending" },
                      { label: "Aprobados", value: "approved" },
                      { label: "Rechazados", value: "rejected" },
                    ]}
                    value={status}
                  />
                </DataTableToolbar>
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Referencia</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          Espacio
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          Producto
                        </TableHead>
                        <TableHead>Importe</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length ? (
                        payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div className="flex min-w-40 flex-col">
                                <span className="font-medium">
                                  {payment.reference}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {formatDate(payment.createdAt)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground lg:table-cell">
                              {payment.workspace.name}
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground md:table-cell">
                              {payment.productLabel}
                            </TableCell>
                            <TableCell>
                              {money(payment.amountMinor, payment.currency)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant[payment.status]}>
                                {statusLabel[payment.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {payment.status === "pending" ? (
                                  <>
                                    <Button
                                      disabled={pending}
                                      onClick={() =>
                                        void run(async () => {
                                          await adminManualPaymentsApi.approve(
                                            payment.id
                                          )
                                        }, "Pago aprobado y aplicado.")
                                      }
                                      size="sm"
                                    >
                                      <Check data-icon="inline-start" />{" "}
                                      Aprobar
                                    </Button>
                                    <Button
                                      disabled={pending}
                                      onClick={() =>
                                        void run(async () => {
                                          await adminManualPaymentsApi.reject(
                                            payment.id
                                          )
                                        }, "Pago rechazado.")
                                      }
                                      size="sm"
                                      variant="brand-secondary"
                                    >
                                      <X data-icon="inline-start" /> Rechazar
                                    </Button>
                                  </>
                                ) : null}
                                {payment.status === "approved" ? (
                                  <span className="text-sm text-muted-foreground">
                                    {payment.reviewedByName ?? "Aplicado"}
                                  </span>
                                ) : (
                                  <Button
                                    aria-label={`Eliminar ${payment.reference}`}
                                    disabled={pending}
                                    onClick={() => setDeleting(payment)}
                                    size="icon-sm"
                                    variant="brand-secondary"
                                  >
                                    <Trash2 />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableEmptyRow
                          colSpan={6}
                          description={
                            hasFilters
                              ? "Prueba con otro término o estado."
                              : "Registra un cobro recibido fuera de Polar para aplicarlo al espacio del cliente."
                          }
                          title={
                            hasFilters
                              ? "No hay coincidencias"
                              : "Todavía no hay pagos manuales"
                          }
                        />
                      )}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination
                  canGoNext={safePage < pageCount}
                  canGoPrevious={safePage > 1}
                  itemLabel="pagos"
                  onNextPage={() =>
                    setPage((current) => Math.min(current + 1, pageCount))
                  }
                  onPreviousPage={() =>
                    setPage((current) => Math.max(current - 1, 1))
                  }
                  rangeEnd={rangeEnd}
                  rangeStart={rangeStart}
                  total={total}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent className="flex flex-col gap-4" value="settings">
            <Card variant="subtle">
              <CardContent className="flex flex-col gap-5 py-5">
                <FieldGroup>
                  <Field orientation="horizontal">
                    <div className="flex flex-col gap-1">
                      <FieldLabel htmlFor="manual-enabled">
                        Aceptar pagos manuales
                      </FieldLabel>
                      <FieldDescription>
                        Muestra las instrucciones de pago fuera de línea a los
                        clientes.
                      </FieldDescription>
                    </div>
                    <Switch
                      checked={settingsDraft.enabled}
                      id="manual-enabled"
                      onCheckedChange={(enabled) =>
                        setSettingsDraft((current) => ({ ...current, enabled }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="manual-prefix">
                      Prefijo de referencia
                    </FieldLabel>
                    <Input
                      id="manual-prefix"
                      maxLength={24}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          referencePrefix: event.target.value,
                        }))
                      }
                      placeholder="PAY-"
                      value={settingsDraft.referencePrefix}
                    />
                    <FieldDescription>
                      Se propone al registrar un pago nuevo.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="manual-instructions">
                      Instrucciones de pago
                    </FieldLabel>
                    <Textarea
                      id="manual-instructions"
                      maxLength={4000}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          instructions: event.target.value,
                        }))
                      }
                      placeholder="Banco, titular, número de cuenta y qué enviar como comprobante."
                      rows={6}
                      value={settingsDraft.instructions}
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button
                disabled={!settingsChanged || pending}
                onClick={() =>
                  void run(async () => {
                    await adminManualPaymentsApi.updateSettings({
                      enabled: settingsDraft.enabled,
                      instructions: settingsDraft.instructions,
                      referencePrefix: settingsDraft.referencePrefix,
                    })
                  }, "Configuración guardada.")
                }
                type="button"
              >
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Guardar cambios
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <ManualPaymentSheet
        onOpenChange={setSheetOpen}
        onSearchWorkspaces={searchWorkspaces}
        onSubmit={async (values) =>
          run(async () => {
            await adminManualPaymentsApi.create(values)
          }, "Pago manual registrado.")
        }
        open={sheetOpen}
        options={options}
        pending={pending}
        prefix={settings.referencePrefix}
      />
      <AlertDialog
        onOpenChange={(open) => (open ? null : setDeleting(null))}
        open={Boolean(deleting)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pago manual</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina el registro «{deleting?.reference}». Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                const target = deleting
                if (!target) return
                void run(async () => {
                  await adminManualPaymentsApi.remove(target.id)
                  setDeleting(null)
                }, "Pago manual eliminado.")
              }}
            >
              <Trash2 data-icon="inline-start" /> Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
