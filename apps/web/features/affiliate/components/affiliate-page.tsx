"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  CircleAlert,
  CircleDollarSign,
  Copy,
  HandCoins,
  MousePointerClick,
  Users,
  Wallet,
  X,
  } from "lucide-react"

import { ApiError, affiliateApi } from "@workspace/api-client"
import type { PortalAffiliateDashboard } from "@workspace/contracts"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
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
import { TablePagination } from "@workspace/ui/components/table-pagination"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import { loginPath } from "@/features/identity/login-redirect"

type Commission = PortalAffiliateDashboard["commissions"][number]
type Withdrawal = PortalAffiliateDashboard["withdrawals"][number]

const pageSize = 10

const commissionLabel: Record<Commission["status"], string> = {
  pending: "Pendiente",
  available: "Disponible",
  paid: "Pagada",
  cancelled: "Cancelada",
}

const commissionVariant: Record<
  Commission["status"],
  "warning" | "info" | "success" | "neutral"
> = {
  pending: "warning",
  available: "info",
  paid: "success",
  cancelled: "neutral",
}

const withdrawalLabel: Record<Withdrawal["status"], string> = {
  requested: "Solicitado",
  approved: "Aprobado",
  paid: "Pagado",
  rejected: "Rechazado",
}

const withdrawalVariant: Record<
  Withdrawal["status"],
  "info" | "warning" | "success" | "destructive"
> = {
  requested: "info",
  approved: "warning",
  paid: "success",
  rejected: "destructive",
}

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("es-EC", {
    currency,
    style: "currency",
  }).format(amountMinor / 100)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function matchesAmount(amountMinor: number, currency: string, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (
    money(amountMinor, currency).toLowerCase().includes(normalized) ||
    (amountMinor / 100).toFixed(2).includes(normalized)
  )
}

function paginate<T>(items: readonly T[], page: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = items.slice((safePage - 1) * pageSize, safePage * pageSize)
  const rangeStart = items.length ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = items.length ? rangeStart + visible.length - 1 : 0
  return { pageCount, rangeEnd, rangeStart, safePage, visible }
}

function WithdrawalSheet({
  availableMinor,
  currency,
  onOpenChange,
  onSubmit,
  open,
  pending,
}: {
  availableMinor: number
  currency: string
  onOpenChange: (open: boolean) => void
  onSubmit: (amountMinor: number) => Promise<boolean>
  open: boolean
  pending: boolean
}) {
  const [amount, setAmount] = useState("")

  useEffect(() => {
    if (!open) setAmount("")
  }, [open])

  const amountMinor = Math.round(Number(amount) * 100)
  const canSubmit =
    Number.isFinite(amountMinor) &&
    amountMinor > 0 &&
    amountMinor <= availableMinor

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error("El monto debe ser mayor a cero y no superar tu saldo.")
      return
    }
    const requested = await onSubmit(amountMinor)
    if (requested) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>Solicitar retiro</SheetTitle>
          <SheetDescription>
            El monto se reserva de tu saldo disponible hasta que se procese la
            solicitud.
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
                <FieldLabel htmlFor="withdrawal-amount">
                  Monto{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={pending}
                  id="withdrawal-amount"
                  min={0}
                  onChange={(event) => setAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={amount}
                />
                <FieldDescription>
                  Disponible: {money(availableMinor, currency)}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              Cancelar
            </Button>
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Wallet data-icon="inline-start" />
              )}
              Solicitar retiro
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AffiliatePage() {
  const router = useRouter()
  const [data, setData] = useState<PortalAffiliateDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [pending, setPending] = useState(false)
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)
  const [commissionQuery, setCommissionQuery] = useState("")
  const [commissionStatus, setCommissionStatus] = useState<
    Commission["status"] | "all"
  >("all")
  const [commissionPage, setCommissionPage] = useState(1)
  const [withdrawalQuery, setWithdrawalQuery] = useState("")
  const [withdrawalStatus, setWithdrawalStatus] = useState<
    Withdrawal["status"] | "all"
  >("all")
  const [withdrawalPage, setWithdrawalPage] = useState(1)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return true
      }
      return false
    },
    [router]
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setData(await affiliateApi.dashboard())
    } catch (error) {
      if (handleError(error)) return
      console.error("Affiliate dashboard request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    void load()
  }, [load])

  async function activate() {
    setPending(true)
    try {
      await affiliateApi.activate()
      await load()
      toast.success("Programa de afiliados activado.")
    } catch (error) {
      if (handleError(error)) return
      console.error("Affiliate activation failed", error)
      toast.error("No pudimos activar el programa. Inténtalo de nuevo.")
    } finally {
      setPending(false)
    }
  }

  async function requestWithdrawal(amountMinor: number) {
    setPending(true)
    try {
      await affiliateApi.requestWithdrawal({ amountMinor })
      await load()
      toast.success("Solicitud de retiro registrada.")
      return true
    } catch (error) {
      if (handleError(error)) return false
      console.error("Affiliate withdrawal request failed", error)
      toast.error("No pudimos registrar el retiro. Inténtalo de nuevo.")
      return false
    } finally {
      setPending(false)
    }
  }

  async function copyCode(code: string) {
    if (!navigator.clipboard) {
      toast.error("Tu navegador no permite copiar el código.")
      return
    }
    try {
      await navigator.clipboard.writeText(code)
      toast.success("Código copiado.")
    } catch {
      toast.error("No pudimos copiar el código. Inténtalo de nuevo.")
    }
  }

  if (isLoading && !data && !loadError) {
    return <PageLoading aria-label="Cargando afiliados" />
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
            description="No pudimos cargar tu programa de afiliados."
            icon={CircleAlert}
            title="Afiliados no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  if (!data.profile) {
    return (
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description="Comparte tu código, consulta comisiones y solicita retiros del saldo disponible."
          title="Afiliados"
        />
        <Card variant="subtle">
          <CardContent>
            <EmptyState
              action={
                <Button disabled={pending} onClick={() => void activate()}>
                  {pending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <HandCoins data-icon="inline-start" />
                  )}
                  Activar programa
                </Button>
              }
              description="Al activarlo recibirás un código propio para atribuir referidos y acumular comisiones."
              icon={HandCoins}
              title="Aún no participas en el programa"
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const { profile, totals } = data
  const commissionRate = (profile.commissionRateBps / 100).toFixed(2)

  const filteredCommissions = data.commissions.filter(
    (commission) =>
      matchesAmount(
        commission.amountMinor,
        commission.currency,
        commissionQuery
      ) &&
      (commissionStatus === "all" || commission.status === commissionStatus)
  )
  const hasCommissionFilters = Boolean(
    commissionQuery || commissionStatus !== "all"
  )
  const commissions = paginate(filteredCommissions, commissionPage)

  const filteredWithdrawals = data.withdrawals.filter(
    (withdrawal) =>
      matchesAmount(
        withdrawal.amountMinor,
        withdrawal.currency,
        withdrawalQuery
      ) &&
      (withdrawalStatus === "all" || withdrawal.status === withdrawalStatus)
  )
  const hasWithdrawalFilters = Boolean(
    withdrawalQuery || withdrawalStatus !== "all"
  )
  const withdrawals = paginate(filteredWithdrawals, withdrawalPage)

  function clearCommissionFilters() {
    setCommissionQuery("")
    setCommissionStatus("all")
    setCommissionPage(1)
  }

  function clearWithdrawalFilters() {
    setWithdrawalQuery("")
    setWithdrawalStatus("all")
    setWithdrawalPage(1)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description="Comparte tu código, consulta comisiones y solicita retiros del saldo disponible."
          title="Afiliados"
        />

        <Card variant="subtle">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm text-muted-foreground">
                Tu código de afiliado
              </span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-lg font-semibold">
                  {profile.code}
                </code>
                <Badge
                  variant={
                    profile.status === "active" ? "success" : "destructive"
                  }
                >
                  {profile.status === "active" ? "Activo" : "Suspendido"}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                Comisión del {commissionRate}% sobre cada conversión atribuida.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void copyCode(profile.code)}
                variant="brand-secondary"
              >
                <Copy data-icon="inline-start" /> Copiar código
              </Button>
            </div>
          </CardContent>
        </Card>

        <CardGrid layout="md-3">
          <MetricCard
            description="Visitas atribuidas a tu código"
            icon={MousePointerClick}
            label="Clics"
            value={totals.visits}
          />
          <MetricCard
            description="Personas registradas"
            icon={Users}
            label="Referidos"
            value={totals.referrals}
          />
          <MetricCard
            description="Referidos que compraron"
            icon={BadgeCheck}
            label="Conversiones"
            value={totals.conversions}
          />
          <MetricCard
            description="Lista para retiro"
            icon={Wallet}
            label="Disponible"
            value={money(totals.availableMinor, totals.currency)}
          />
          <MetricCard
            description="Aún en validación"
            icon={CircleDollarSign}
            label="Pendiente"
            value={money(totals.pendingMinor, totals.currency)}
          />
          <MetricCard
            description="Retirado históricamente"
            icon={HandCoins}
            label="Pagado"
            value={money(totals.paidMinor, totals.currency)}
          />
        </CardGrid>

        <Tabs
          defaultValue="commissions"
          onValueChange={() => {
            setCommissionPage(1)
            setWithdrawalPage(1)
          }}
        >
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="commissions">Comisiones</TabsTrigger>
            <TabsTrigger value="withdrawals">Retiros</TabsTrigger>
          </TabsList>

          <TabsContent className="pt-3" value="commissions">
            <Card variant="subtle">
              <DataTableHeader
                search={{
                  ariaLabel: "Buscar comisiones",
                  onChange: (value) => {
                    setCommissionQuery(value)
                    setCommissionPage(1)
                  },
                  placeholder: "Buscar por monto...",
                  value: commissionQuery,
                }}
              />
              <CardContent className="flex flex-col gap-4 px-0">
                <DataTableToolbar
                  actions={
                    hasCommissionFilters ? (
                      <Button
                        onClick={clearCommissionFilters}
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
                      setCommissionStatus(value as Commission["status"] | "all")
                      setCommissionPage(1)
                    }}
                    options={[
                      { label: "Todas", value: "all" },
                      { label: "Pendientes", value: "pending" },
                      { label: "Disponibles", value: "available" },
                      { label: "Pagadas", value: "paid" },
                      { label: "Canceladas", value: "cancelled" },
                    ]}
                    value={commissionStatus}
                  />
                </DataTableToolbar>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comisión</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Generada
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.visible.length ? (
                      commissions.visible.map((commission) => (
                        <TableRow key={commission.id}>
                          <TableCell className="font-medium">
                            {money(commission.amountMinor, commission.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={commissionVariant[commission.status]}
                            >
                              {commissionLabel[commission.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {formatDate(commission.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableEmptyRow
                        action={
                          hasCommissionFilters ? (
                            <Button
                              onClick={clearCommissionFilters}
                              variant="outline"
                            >
                              Restablecer filtros
                            </Button>
                          ) : null
                        }
                        colSpan={3}
                        description={
                          hasCommissionFilters
                            ? "Prueba con otro término o estado."
                            : "Cuando alguien compre usando tu código verás aquí su comisión."
                        }
                        title={
                          hasCommissionFilters
                            ? "No hay coincidencias"
                            : "Aún no hay comisiones"
                        }
                      />
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  canGoNext={commissions.safePage < commissions.pageCount}
                  canGoPrevious={commissions.safePage > 1}
                  itemLabel="comisiones"
                  onNextPage={() =>
                    setCommissionPage((current) =>
                      Math.min(current + 1, commissions.pageCount)
                    )
                  }
                  onPreviousPage={() =>
                    setCommissionPage((current) => Math.max(current - 1, 1))
                  }
                  rangeEnd={commissions.rangeEnd}
                  rangeStart={commissions.rangeStart}
                  total={filteredCommissions.length}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent className="pt-3" value="withdrawals">
            <Card variant="subtle">
              <DataTableHeader
                action={
                  <Button
                    disabled={totals.availableMinor <= 0}
                    onClick={() => setIsWithdrawalOpen(true)}
                    size="sm"
                    type="button"
                  >
                    <Wallet data-icon="inline-start" /> Solicitar retiro
                  </Button>
                }
                search={{
                  ariaLabel: "Buscar retiros",
                  onChange: (value) => {
                    setWithdrawalQuery(value)
                    setWithdrawalPage(1)
                  },
                  placeholder: "Buscar por monto...",
                  value: withdrawalQuery,
                }}
              />
              <CardContent className="flex flex-col gap-4 px-0">
                <DataTableToolbar
                  actions={
                    hasWithdrawalFilters ? (
                      <Button
                        onClick={clearWithdrawalFilters}
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
                      setWithdrawalStatus(value as Withdrawal["status"] | "all")
                      setWithdrawalPage(1)
                    }}
                    options={[
                      { label: "Todos", value: "all" },
                      { label: "Solicitados", value: "requested" },
                      { label: "Aprobados", value: "approved" },
                      { label: "Pagados", value: "paid" },
                      { label: "Rechazados", value: "rejected" },
                    ]}
                    value={withdrawalStatus}
                  />
                </DataTableToolbar>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Solicitado
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.visible.length ? (
                      withdrawals.visible.map((withdrawal) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell className="font-medium">
                            {money(withdrawal.amountMinor, withdrawal.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={withdrawalVariant[withdrawal.status]}
                            >
                              {withdrawalLabel[withdrawal.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {formatDate(withdrawal.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableEmptyRow
                        action={
                          hasWithdrawalFilters ? (
                            <Button
                              onClick={clearWithdrawalFilters}
                              variant="outline"
                            >
                              Restablecer filtros
                            </Button>
                          ) : null
                        }
                        colSpan={3}
                        description={
                          hasWithdrawalFilters
                            ? "Prueba con otro término o estado."
                            : "Tus solicitudes de retiro aparecerán en este historial."
                        }
                        title={
                          hasWithdrawalFilters
                            ? "No hay coincidencias"
                            : "No hay retiros"
                        }
                      />
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  canGoNext={withdrawals.safePage < withdrawals.pageCount}
                  canGoPrevious={withdrawals.safePage > 1}
                  itemLabel="retiros"
                  onNextPage={() =>
                    setWithdrawalPage((current) =>
                      Math.min(current + 1, withdrawals.pageCount)
                    )
                  }
                  onPreviousPage={() =>
                    setWithdrawalPage((current) => Math.max(current - 1, 1))
                  }
                  rangeEnd={withdrawals.rangeEnd}
                  rangeStart={withdrawals.rangeStart}
                  total={filteredWithdrawals.length}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <WithdrawalSheet
        availableMinor={totals.availableMinor}
        currency={totals.currency}
        onOpenChange={setIsWithdrawalOpen}
        onSubmit={requestWithdrawal}
        open={isWithdrawalOpen}
        pending={pending}
      />
    </>
  )
}
