"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CircleAlert, Copy, HandCoins, Wallet, X } from "lucide-react"

import { ApiError, affiliateApi } from "@workspace/api-client"
import type { PortalAffiliateDashboard } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
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
import { TablePagination } from "@/components/table-pagination"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import { useTranslations } from "next-intl"
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
  const t = useTranslations("affiliate")
  const [amount, setAmount] = useState("")
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) setAmount("")
  }

  const amountMinor = Math.round(Number(amount) * 100)
  const canSubmit =
    Number.isFinite(amountMinor) &&
    amountMinor > 0 &&
    amountMinor <= availableMinor

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error(t("invalidAmount"))
      return
    }
    const requested = await onSubmit(amountMinor)
    if (requested) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{t("requestWithdrawal")}</SheetTitle>
          <SheetDescription>{t("withdrawalDescription")}</SheetDescription>
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
                  {t("amount")}{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
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
                  {t("availableAmount", {
                    amount: money(availableMinor, currency),
                  })}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </div>
          <SheetActions>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Wallet data-icon="inline-start" />
              )}
              {t("requestWithdrawal")}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AffiliatePage() {
  const t = useTranslations("affiliate")
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
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  async function activate() {
    setPending(true)
    try {
      await affiliateApi.activate()
      await load()
      toast.success(t("activated"))
    } catch (error) {
      if (handleError(error)) return
      console.error("Affiliate activation failed", error)
      toast.error(t("activateFailed"))
    } finally {
      setPending(false)
    }
  }

  async function requestWithdrawal(amountMinor: number) {
    setPending(true)
    try {
      await affiliateApi.requestWithdrawal({ amountMinor })
      await load()
      toast.success(t("withdrawalRequested"))
      return true
    } catch (error) {
      if (handleError(error)) return false
      console.error("Affiliate withdrawal request failed", error)
      toast.error(t("withdrawalFailed"))
      return false
    } finally {
      setPending(false)
    }
  }

  async function copyCode(code: string) {
    if (!navigator.clipboard) {
      toast.error(t("clipboardUnsupported"))
      return
    }
    try {
      await navigator.clipboard.writeText(code)
      toast.success(t("codeCopied"))
    } catch {
      toast.error(t("copyFailed"))
    }
  }

  if (isLoading && !data && !loadError) {
    return <PageLoading aria-label={t("loading")} />
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
            description={t("loadFailedDescription")}
            icon={CircleAlert}
            title={t("unavailableTitle")}
          />
        </CardContent>
      </Card>
    )
  }

  if (!data.profile) {
    return (
      <div className="flex flex-col gap-4">
        <CollectionHeader description={t("description")} title={t("title")} />
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
                  {t("activateProgram")}
                </Button>
              }
              description={t("joinDescription")}
              icon={HandCoins}
              title={t("joinTitle")}
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
        <CollectionHeader description={t("description")} title={t("title")} />

        <Card variant="subtle">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm text-muted-foreground">
                {t("yourCode")}
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
                  {profile.status === "active"
                    ? t("profileStatus.active")
                    : t("profileStatus.suspended")}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {t("commissionRateHint", { rate: commissionRate })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void copyCode(profile.code)}
                variant="brand-secondary"
              >
                <Copy data-icon="inline-start" /> {t("copyCode")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs
          defaultValue="commissions"
          onValueChange={() => {
            setCommissionPage(1)
            setWithdrawalPage(1)
          }}
        >
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="commissions">
              {t("tab.commissions")}
            </TabsTrigger>
            <TabsTrigger value="withdrawals">
              {t("tab.withdrawals")}
            </TabsTrigger>
          </TabsList>

          <TabsContent className="pt-3" value="commissions">
            <Card variant="subtle">
              <DataTableHeader
                search={{
                  ariaLabel: t("searchCommissions"),
                  onChange: (value) => {
                    setCommissionQuery(value)
                    setCommissionPage(1)
                  },
                  placeholder: t("searchByAmount"),
                  value: commissionQuery,
                }}
              />
              <CardContent className="flex flex-col gap-4 px-0">
                <DataTableToolbar
                  actions={
                    commissionStatus !== "all" ? (
                      <Button
                        onClick={clearCommissionFilters}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <X /> {t("clear")}
                      </Button>
                    ) : undefined
                  }
                >
                  <DataTableFilter
                    ariaLabel={t("filterStatus")}
                    label={t("statusColumn")}
                    onValueChange={(value) => {
                      setCommissionStatus(value as Commission["status"] | "all")
                      setCommissionPage(1)
                    }}
                    options={[
                      { label: t("all"), value: "all" },
                      {
                        label: t("commissionFilter.pending"),
                        value: "pending",
                      },
                      {
                        label: t("commissionFilter.available"),
                        value: "available",
                      },
                      { label: t("commissionFilter.paid"), value: "paid" },
                      {
                        label: t("commissionFilter.cancelled"),
                        value: "cancelled",
                      },
                    ]}
                    value={commissionStatus}
                  />
                </DataTableToolbar>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("commission")}</TableHead>
                      <TableHead>{t("statusColumn")}</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t("generated")}
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
                              {t("resetFilters")}
                            </Button>
                          ) : null
                        }
                        colSpan={3}
                        description={
                          hasCommissionFilters
                            ? t("emptyFilteredDescription")
                            : t("commissionsEmptyDescription")
                        }
                        title={
                          hasCommissionFilters
                            ? t("noMatches")
                            : t("commissionsEmptyTitle")
                        }
                      />
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  canGoNext={commissions.safePage < commissions.pageCount}
                  canGoPrevious={commissions.safePage > 1}
                  itemLabel={t("commissions")}
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
                    <Wallet data-icon="inline-start" /> {t("requestWithdrawal")}
                  </Button>
                }
                search={{
                  ariaLabel: t("searchWithdrawals"),
                  onChange: (value) => {
                    setWithdrawalQuery(value)
                    setWithdrawalPage(1)
                  },
                  placeholder: t("searchByAmount"),
                  value: withdrawalQuery,
                }}
              />
              <CardContent className="flex flex-col gap-4 px-0">
                <DataTableToolbar
                  actions={
                    withdrawalStatus !== "all" ? (
                      <Button
                        onClick={clearWithdrawalFilters}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <X /> {t("clear")}
                      </Button>
                    ) : undefined
                  }
                >
                  <DataTableFilter
                    ariaLabel={t("filterStatus")}
                    label={t("statusColumn")}
                    onValueChange={(value) => {
                      setWithdrawalStatus(value as Withdrawal["status"] | "all")
                      setWithdrawalPage(1)
                    }}
                    options={[
                      { label: t("all"), value: "all" },
                      {
                        label: t("withdrawalFilter.requested"),
                        value: "requested",
                      },
                      {
                        label: t("withdrawalFilter.approved"),
                        value: "approved",
                      },
                      { label: t("withdrawalFilter.paid"), value: "paid" },
                      {
                        label: t("withdrawalFilter.rejected"),
                        value: "rejected",
                      },
                    ]}
                    value={withdrawalStatus}
                  />
                </DataTableToolbar>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("amount")}</TableHead>
                      <TableHead>{t("statusColumn")}</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t("requested")}
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
                              {t("resetFilters")}
                            </Button>
                          ) : null
                        }
                        colSpan={3}
                        description={
                          hasWithdrawalFilters
                            ? t("emptyFilteredDescription")
                            : t("withdrawalsEmptyDescription")
                        }
                        title={
                          hasWithdrawalFilters
                            ? t("noMatches")
                            : t("withdrawalsEmptyTitle")
                        }
                      />
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  canGoNext={withdrawals.safePage < withdrawals.pageCount}
                  canGoPrevious={withdrawals.safePage > 1}
                  itemLabel={t("withdrawals")}
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
