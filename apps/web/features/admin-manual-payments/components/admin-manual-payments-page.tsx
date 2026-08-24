"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  BadgeDollarSign,
  Check,
  CircleAlert,
  CircleDot,
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
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { Input } from "@workspace/ui/components/input"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { PageLoading } from "@/components/page-loading"
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
  SheetActions,
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
import { TablePagination } from "@/components/table-pagination"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"

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
  const t = useTranslations("adminManualPayments")
  const format = useFormatter()
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [workspaceQuery, setWorkspaceQuery] = useState("")

  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValues({ ...emptyForm, reference: prefix })
      setWorkspaceQuery("")
    }
  }

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
      toast.error(t("missingFields"))
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
    <Sheet
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      open={open}
    >
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{t("createTitle")}</SheetTitle>
          <SheetDescription>{t("createDescription")}</SheetDescription>
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
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Input
                  aria-label={t("searchWorkspace")}
                  onChange={(event) => setWorkspaceQuery(event.target.value)}
                  placeholder={t("searchWorkspacePlaceholder")}
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
                    <SelectValue placeholder={t("selectWorkspace")} />
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
                <FieldDescription>{t("ownerHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-product-type">
                  {t("product")}
                </FieldLabel>
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
                      <SelectItem value="plan">
                        {t("productType.plan")}
                      </SelectItem>
                      <SelectItem value="credits">
                        {t("productType.creditsPack")}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-product">
                  {values.productType === "plan"
                    ? t("productType.plan")
                    : t("productType.pack")}{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
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
                    <SelectValue placeholder={t("selectOffer")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {catalog.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label} ·{" "}
                          {format.number(option.amountMinor / 100, {
                            currency: option.currency,
                            style: "currency",
                          })}
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
                  <span className="sr-only"> {t("required")}</span>
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
                  <span className="sr-only"> {t("required")}</span>
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
                  placeholder={t("referencePlaceholder")}
                  value={values.reference}
                />
                <FieldDescription>{t("referenceHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-info">
                  {t("paymentInfo")}
                </FieldLabel>
                <Textarea
                  id="manual-info"
                  maxLength={2000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      paymentInfo: event.target.value,
                    }))
                  }
                  placeholder={t("paymentInfoPlaceholder")}
                  rows={3}
                  value={values.paymentInfo}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="manual-note">{t("note")}</FieldLabel>
                <Textarea
                  id="manual-note"
                  maxLength={2000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder={t("notePlaceholder")}
                  rows={3}
                  value={values.note}
                />
              </Field>
            </FieldGroup>
          </div>
          <SheetActions>
            <Button
              disabled={pending}
              onClick={close}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              {t("register")}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AdminManualPaymentsPage() {
  const t = useTranslations("adminManualPayments")
  const format = useFormatter()
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
      if (
        error instanceof ApiError &&
        error.code === "MANUAL_PAYMENT_REFERENCE_TAKEN"
      ) {
        toast.error(t("referenceTaken"))
        return false
      }
      console.error("Manual payment action failed", error)
      toast.error(t("actionFailed"))
      return false
    } finally {
      setPending(false)
    }
  }

  if (forbidden) {
    return (
      <EmptyState
        description={t("forbiddenDescription")}
        icon={ShieldX}
        title={t("forbiddenTitle")}
      />
    )
  }

  if (isLoading && !payments.length && !loadError) {
    return <PageLoading aria-label={t("loading")} />
  }

  if (loadError) {
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
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("pageDescription")}
          title={t("pageTitle")}
        />
        <Tabs defaultValue="payments">
          <TabsList aria-label={t("sectionsLabel")}>
            <TabsTrigger value="payments">{t("tab.payments")}</TabsTrigger>
            <TabsTrigger value="settings">{t("tab.settings")}</TabsTrigger>
          </TabsList>
          <TabsContent className="flex flex-col gap-4" value="payments">
            <CardGrid>
              <MetricCard
                description={t("metrics.pendingDescription")}
                icon={CircleDot}
                label={t("metrics.pending")}
                value={metrics.pending}
              />
              <MetricCard
                description={t("metrics.approvedDescription")}
                icon={Check}
                label={t("metrics.approved")}
                value={metrics.approved}
              />
              <MetricCard
                description={t("metrics.rejectedDescription")}
                icon={X}
                label={t("metrics.rejected")}
                value={metrics.rejected}
              />
              <MetricCard
                description={t("metrics.amountDescription")}
                icon={BadgeDollarSign}
                label={t("metrics.amount")}
                value={format.number(metrics.approvedAmountMinor / 100, {
                  currency: metrics.currency,
                  style: "currency",
                })}
              />
            </CardGrid>
            <Card variant="subtle">
              <DataTableHeader
                action={
                  <Button
                    className="hidden sm:inline-flex"
                    onClick={() => {
                      searchWorkspaces("")
                      setSheetOpen(true)
                    }}
                    size="sm"
                    type="button"
                  >
                    <Plus data-icon="inline-start" /> {t("registerPayment")}
                  </Button>
                }
                search={{
                  ariaLabel: t("searchLabel"),
                  onChange: (value) => {
                    setQuery(value)
                    setPage(1)
                  },
                  placeholder: t("searchPlaceholder"),
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
                        <X /> {t("clear")}
                      </Button>
                    ) : undefined
                  }
                >
                  <DataTableFilter
                    ariaLabel={t("filterStatus")}
                    label={t("statusColumn")}
                    onValueChange={(value) => {
                      setStatus(value as ManualPaymentStatus | "all")
                      setPage(1)
                    }}
                    options={[
                      { label: t("all"), value: "all" },
                      { label: t("filter.pending"), value: "pending" },
                      { label: t("filter.approved"), value: "approved" },
                      { label: t("filter.rejected"), value: "rejected" },
                    ]}
                    value={status}
                  />
                </DataTableToolbar>
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("reference")}</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          {t("workspace")}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t("product")}
                        </TableHead>
                        <TableHead>{t("amount")}</TableHead>
                        <TableHead>{t("statusColumn")}</TableHead>
                        <TableHead className="text-right">
                          {t("actions")}
                        </TableHead>
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
                                  {format.dateTime(
                                    new Date(payment.createdAt),
                                    { dateStyle: "medium", timeStyle: "short" }
                                  )}
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
                              {format.number(payment.amountMinor / 100, {
                                currency: payment.currency,
                                style: "currency",
                              })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant[payment.status]}>
                                {t(`status.${payment.status}`)}
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
                                        }, t("approvedToast"))
                                      }
                                      size="sm"
                                    >
                                      <Check data-icon="inline-start" />{" "}
                                      {t("approve")}
                                    </Button>
                                    <Button
                                      disabled={pending}
                                      onClick={() =>
                                        void run(async () => {
                                          await adminManualPaymentsApi.reject(
                                            payment.id
                                          )
                                        }, t("rejectedToast"))
                                      }
                                      size="sm"
                                      variant="brand-secondary"
                                    >
                                      <X data-icon="inline-start" />{" "}
                                      {t("reject")}
                                    </Button>
                                  </>
                                ) : null}
                                {payment.status === "approved" ? (
                                  <span className="text-sm text-muted-foreground">
                                    {payment.reviewedByName ?? t("applied")}
                                  </span>
                                ) : (
                                  <Button
                                    aria-label={t("deleteRow", {
                                      reference: payment.reference,
                                    })}
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
                              ? t("emptyFilteredDescription")
                              : t("emptyDescription")
                          }
                          title={hasFilters ? t("noMatches") : t("emptyTitle")}
                        />
                      )}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination
                  canGoNext={safePage < pageCount}
                  canGoPrevious={safePage > 1}
                  itemLabel={t("payments")}
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
            <FloatingActionButton
              label={t("registerPayment")}
              onClick={() => {
                searchWorkspaces("")
                setSheetOpen(true)
              }}
            />
          </TabsContent>
          <TabsContent className="flex flex-col gap-4" value="settings">
            <Card variant="subtle">
              <CardContent className="flex flex-col gap-5 py-5">
                <FieldGroup>
                  <Field orientation="horizontal">
                    <div className="flex flex-col gap-1">
                      <FieldLabel htmlFor="manual-enabled">
                        {t("acceptManual")}
                      </FieldLabel>
                      <FieldDescription>
                        {t("acceptManualHint")}
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
                      {t("referencePrefix")}
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
                      placeholder={t("referencePrefixPlaceholder")}
                      value={settingsDraft.referencePrefix}
                    />
                    <FieldDescription>
                      {t("referencePrefixHint")}
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="manual-instructions">
                      {t("instructions")}
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
                      placeholder={t("instructionsPlaceholder")}
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
                  }, t("settingsSaved"))
                }
                type="button"
              >
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {t("saveChanges")}
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
          }, t("created"))
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
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { reference: deleting?.reference ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                const target = deleting
                if (!target) return
                void run(async () => {
                  await adminManualPaymentsApi.remove(target.id)
                  setDeleting(null)
                }, t("deleted"))
              }}
            >
              <Trash2 data-icon="inline-start" /> {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
