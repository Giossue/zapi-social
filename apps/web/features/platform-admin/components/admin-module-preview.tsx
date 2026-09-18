"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import {
  adminImpersonationApi,
  adminOperationsApi,
  ApiError,
} from "@workspace/api-client"
import type {
  AdminOperationActionKey,
  AdminOperationView,
} from "@workspace/contracts"
import type { LucideIcon } from "lucide-react"
import {
  Check,
  CircleAlert,
  EllipsisVertical,
  Eye,
  PackagePlus,
  Pencil,
  Plus,
  ShieldX,
  Trash2,
  UserPlus,
} from "lucide-react"
import { toast } from "@workspace/ui/components/toast"

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
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
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
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@/components/page-loading"
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
import { TablePagination } from "@/components/table-pagination"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

export type AdminModuleKey =
  "users" | "credits" | "affiliate" | "coupons" | "payments" | "subscriptions"
type Tone = "success" | "warning" | "neutral" | "destructive"
type Icon = LucideIcon

type Row = AdminOperationView["rows"][number]
type Cell = Row["cells"][number]
type Action = Row["actions"][number]
type Tab = {
  value: string
  columnKeys: readonly string[]
  primaryAction?: { icon: Icon; fieldKeys: readonly string[] }
}
type Module = { tabs: [Tab, ...Tab[]] }

const modules: Record<AdminModuleKey, Module> = {
  users: {
    tabs: [
      {
        value: "users",
        columnKeys: ["user", "access", "plan", "workspace", "signup"],
        primaryAction: {
          icon: UserPlus,
          fieldKeys: ["displayName", "email", "plan"],
        },
      },
    ],
  },
  credits: {
    tabs: [
      {
        value: "packs",
        columnKeys: ["pack", "credits", "price", "purchases", "order"],
        primaryAction: {
          icon: PackagePlus,
          fieldKeys: ["name", "credits", "price"],
        },
      },
      {
        value: "ledger",
        columnKeys: ["user", "type", "pack", "credits", "balance", "date"],
      },
      {
        value: "usage",
        columnKeys: [
          "user",
          "action",
          "feature",
          "credits",
          "quantity",
          "date",
        ],
      },
    ],
  },
  affiliate: {
    tabs: [
      {
        value: "overview",
        columnKeys: ["affiliate", "code", "clicks", "conversions", "balance"],
      },
      {
        value: "commissions",
        columnKeys: [
          "affiliate",
          "referred",
          "payment",
          "commission",
          "created",
        ],
      },
      {
        value: "withdrawals",
        columnKeys: ["affiliate", "request", "method", "amount", "requested"],
      },
    ],
  },
  coupons: {
    tabs: [
      {
        value: "coupons",
        columnKeys: ["coupon", "discount", "usage", "plans", "validity"],
        primaryAction: {
          icon: Plus,
          fieldKeys: ["name", "code", "discountValue"],
        },
      },
    ],
  },
  payments: {
    tabs: [
      {
        value: "payments",
        columnKeys: [
          "invoice",
          "user",
          "product",
          "transaction",
          "amount",
          "date",
        ],
      },
    ],
  },
  subscriptions: {
    tabs: [
      {
        value: "subscriptions",
        columnKeys: [
          "subscription",
          "customer",
          "plan",
          "amount",
          "renewal",
          "updated",
        ],
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

type Translate = (key: string, values?: Record<string, string>) => string
type Formatter = ReturnType<typeof useFormatter>

function money(
  format: Formatter,
  value: { amountMinor: number; currency: string }
) {
  return format.number(value.amountMinor / 100, {
    style: "currency",
    currency: value.currency,
  })
}

function cellText(t: Translate, format: Formatter, cell: Cell) {
  const value =
    cell.primaryDate !== undefined
      ? format.dateTime(new Date(cell.primaryDate), "date")
      : cell.primaryMoney !== undefined
        ? money(format, cell.primaryMoney)
        : cell.primaryNumber !== undefined
          ? format.number(cell.primaryNumber)
          : null

  if (!cell.primaryKey) return value ?? cell.primary
  return t(cell.primaryKey, {
    ...cell.primaryArgs,
    ...(value === null ? {} : { value }),
  })
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

function responsiveColumnClass(index: number) {
  if (index === 0) return undefined
  return index <= 2 ? "hidden md:table-cell" : "hidden lg:table-cell"
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
  const translate = useTranslations("adminOperations")
  const t = translate as unknown as Translate
  const format = useFormatter()
  const moduleConfig = modules[moduleKey]
  const firstTab = moduleConfig.tabs[0]
  const [activeTab, setActiveTab] = React.useState(firstTab.value)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [pageIndex, setPageIndex] = React.useState(0)
  const pageSize = 10
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingRowId, setEditingRowId] = React.useState<string | null>(null)
  const [fieldAction, setFieldAction] = React.useState<{
    key: AdminOperationActionKey
    labelKey: string
    fieldKeys: string[]
    rowId: string
  } | null>(null)
  const [fieldActionValues, setFieldActionValues] = React.useState<string[]>([])
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
    actionKeyLabel: string
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
  const primaryAction = active.primaryAction
  const PrimaryIcon = primaryAction?.icon
  const formComplete =
    primaryAction?.fieldKeys.every((_, index) =>
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
        description={t("loadFailed")}
        icon={CircleAlert}
        title={t("loadFailedTitle")}
      />
    )
  }

  if (requestState === "forbidden") {
    return (
      <EmptyState
        description={t("forbiddenDescription")}
        icon={ShieldX}
        title={t("forbiddenTitle")}
      />
    )
  }

  if (!remote) {
    return <PageLoading className="min-h-80" />
  }

  function openCreateSheet() {
    setFormValues(primaryAction?.fieldKeys.map(() => "") ?? [])
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
          {t(`module.${moduleKey}.title`)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(`module.${moduleKey}.description`)}
        </p>
      </header>

      {moduleConfig.tabs.length > 1 ? (
        <Tabs onValueChange={changeTab} value={activeTab}>
          <TabsList aria-label={t(`module.${moduleKey}.tabsLabel`)}>
            {moduleConfig.tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {t(`tab.${tab.value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

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
                {t(`create.${moduleKey}.label`)}
              </Button>
            ) : undefined
          }
          filters={
            <DataTableToolbar className="px-0">
              <DataTableFilter
                ariaLabel={t("filterStatus")}
                label={t("statusColumn")}
                onValueChange={(value) => {
                  setStatus(value)
                  setPageIndex(0)
                }}
                options={[
                  { label: t("allStatuses"), value: "all" },
                  ...statuses.map((item) => ({
                    label: t(`status.${item}`),
                    value: item,
                  })),
                ]}
                value={status}
              />
            </DataTableToolbar>
          }
          search={{
            ariaLabel: t("searchAriaLabel", {
              section: t(`tab.${active.value}`),
            }),
            onChange: (value) => {
              setSearch(value)
              setPageIndex(0)
            },
            placeholder: t(`search.${active.value}`),
            value: search,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <Table>
            <TableHeader>
              <TableRow>
                {active.columnKeys.map((column, index) => (
                  <TableHead
                    className={responsiveColumnClass(index)}
                    key={column}
                  >
                    {t(`column.${column}`)}
                  </TableHead>
                ))}
                <TableHead>{t("statusColumn")}</TableHead>
                <TableHead className="text-right">
                  {t("actionsColumn")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row) => (
                <TableRow key={row.id}>
                  {row.cells.map((cell, index) => (
                    <TableCell
                      className={responsiveColumnClass(index)}
                      key={`${row.id}-${active.columnKeys[index] ?? index}`}
                    >
                      <div className="grid gap-0.5">
                        <span
                          className={
                            cell.mono ? "font-mono text-xs" : "font-medium"
                          }
                        >
                          {cellText(t, format, cell)}
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
                    <StatusBadge
                      label={t(`status.${row.statusKey}`)}
                      tone={row.tone}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label={t("rowActions", {
                            row: row.cells[0]?.primary || row.id,
                          })}
                          size="icon-sm"
                          variant="brand-secondary"
                        >
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.actions.map((action, index) => (
                          <React.Fragment key={action.labelKey}>
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
                                      actionKeyLabel: action.labelKey,
                                      actionKey: action.key,
                                      id: row.id,
                                      resource: row.cells[0]?.primary ?? row.id,
                                    })
                                    return
                                  }
                                  if (action.key === "view") {
                                    if (
                                      moduleKey === "affiliate" &&
                                      action.labelKey === "viewCommissions"
                                    ) {
                                      setActiveTab("commissions")
                                      setSearch(row.cells[0]?.primary ?? "")
                                      setPageIndex(0)
                                      return
                                    }
                                    setDetailRow(row)
                                    return
                                  }
                                  if (action.fieldKeys?.length) {
                                    setFieldAction({
                                      key: action.key,
                                      labelKey: action.labelKey,
                                      fieldKeys: [...action.fieldKeys],
                                      rowId: row.id,
                                    })
                                    setFieldActionValues(
                                      action.fieldKeys.map(() => "")
                                    )
                                    return
                                  }
                                  if (action.key === "impersonate") {
                                    setSaving(true)
                                    void adminImpersonationApi
                                      .start(row.id)
                                      .then(() => {
                                        window.location.assign("/portal")
                                      })
                                      .catch(() =>
                                        toast.error(t("actionFailed"))
                                      )
                                      .finally(() => setSaving(false))
                                    return
                                  }
                                  if (action.key === "edit" && primaryAction) {
                                    setEditingRowId(row.id)
                                    setFormValues(
                                      editValuesFor(
                                        moduleKey,
                                        row,
                                        primaryAction.fieldKeys.length
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
                                      toast.success(
                                        t(`message.${result.messageKey}`)
                                      )
                                      setRefreshKey((current) => current + 1)
                                    })
                                    .catch(() => toast.error(t("actionFailed")))
                                    .finally(() => setSaving(false))
                                }}
                              >
                                <RowActionIcon action={action} index={index} />
                                {t(`rowAction.${action.labelKey}`)}
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
                  colSpan={active.columnKeys.length + 2}
                  description={
                    search || status !== "all"
                      ? t("emptyFilteredDescription")
                      : t(`empty.${active.value}.description`)
                  }
                  title={
                    search || status !== "all"
                      ? t(`empty.${active.value}.noMatches`)
                      : t(`empty.${active.value}.title`)
                  }
                />
              ) : null}
            </TableBody>
          </Table>
          <TablePagination
            canGoNext={currentPageIndex < pageCount - 1}
            canGoPrevious={currentPageIndex > 0}
            itemLabel={t(`itemLabel.${active.value}`)}
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
          label={t(`create.${moduleKey}.label`)}
          onClick={openCreateSheet}
        />
      ) : null}

      <Sheet
        onOpenChange={(open) => {
          if (!saving && !open) setFieldAction(null)
        }}
        open={Boolean(fieldAction)}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
          <form
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              if (!fieldAction) return
              if (fieldActionValues.some((value) => !value.trim())) {
                toast.error(t("missingFields"))
                return
              }
              setSaving(true)
              void adminOperationsApi
                .action(
                  moduleKey,
                  activeTab,
                  fieldAction.rowId,
                  fieldAction.key,
                  fieldActionValues
                )
                .then((result) => {
                  setFieldAction(null)
                  toast.success(t(`message.${result.messageKey}`))
                  setRefreshKey((current) => current + 1)
                })
                .catch(() => toast.error(t("saveFailed")))
                .finally(() => setSaving(false))
            }}
          >
            <SheetHeader className="border-b pr-12">
              <SheetTitle>
                {fieldAction ? t(`rowAction.${fieldAction.labelKey}`) : ""}
              </SheetTitle>
              <SheetDescription>{t("fieldActionHint")}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <FieldGroup>
                {fieldAction?.fieldKeys.map((field, index) => (
                  <Field key={field}>
                    <RequiredLabel>{t(`field.${field}`)}</RequiredLabel>
                    <Input
                      aria-required="true"
                      name={`action-field-${index}`}
                      onChange={(event) =>
                        setFieldActionValues((current) =>
                          current.map((value, valueIndex) =>
                            valueIndex === index ? event.target.value : value
                          )
                        )
                      }
                      placeholder={t(`field.${field}`)}
                      value={fieldActionValues[index] ?? ""}
                    />
                  </Field>
                ))}
              </FieldGroup>
            </div>
            <SheetActions>
              <Button
                disabled={saving}
                onClick={() => setFieldAction(null)}
                type="button"
                variant="brand-secondary"
              >
                {t("cancel")}
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {t("apply")}
              </Button>
            </SheetActions>
          </form>
        </SheetContent>
      </Sheet>
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
                  toast.error(t("missingFields"))
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
                    toast.success(t(`message.${result.messageKey}`))
                    setRefreshKey((current) => current + 1)
                  })
                  .catch(() => toast.error(t("saveFailed")))
                  .finally(() => setSaving(false))
              }}
            >
              <SheetHeader className="border-b pr-12">
                <SheetTitle>
                  {t(
                    editingRowId
                      ? `create.${moduleKey}.editTitle`
                      : `create.${moduleKey}.dialogTitle`
                  )}
                </SheetTitle>
                <SheetDescription>
                  {t(`create.${moduleKey}.dialogDescription`)}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <FieldGroup>
                  {primaryAction.fieldKeys.map((field, index) => (
                    <Field key={field}>
                      <RequiredLabel>{t(`field.${field}`)}</RequiredLabel>
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
                        placeholder={t(`field.${field}`)}
                        value={formValues[index] ?? ""}
                      />
                    </Field>
                  ))}
                </FieldGroup>
              </div>
              <SheetActions>
                <Button
                  disabled={saving}
                  onClick={() => setDialogOpen(false)}
                  type="button"
                  variant="brand-secondary"
                >
                  {t("cancel")}
                </Button>
                <Button disabled={!formComplete || saving} type="submit">
                  {saving ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Plus aria-hidden="true" data-icon="inline-start" />
                  )}
                  {saving ? t("saving") : t("save")}
                </Button>
              </SheetActions>
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
            <SheetTitle>
              {detailRow?.cells[0]?.primary || t("detail")}
            </SheetTitle>
            <SheetDescription>{t("detailDescription")}</SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4">
            {detailRow?.cells.map((cell, index) => (
              <div
                className="grid gap-0.5"
                key={`${cell.primaryKey ?? cell.primary}-${index}`}
              >
                <span className="text-xs text-muted-foreground">
                  {active.columnKeys[index]
                    ? t(`column.${active.columnKeys[index]}`)
                    : t("fieldNumber", { index: String(index + 1) })}
                </span>
                <span className={cell.mono ? "font-mono text-sm" : "text-sm"}>
                  {cellText(t, format, cell)}
                </span>
                {cell.secondary ? (
                  <span className="text-xs text-muted-foreground">
                    {cell.secondary}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <SheetActions>
            <Button
              onClick={() => setDetailRow(null)}
              variant="brand-secondary"
            >
              {t("close")}
            </Button>
          </SheetActions>
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
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDestructive
                ? t("confirmDescription", {
                    action: t(`rowAction.${pendingDestructive.actionKeyLabel}`),
                    resource: pendingDestructive.resource,
                  })
                : t("confirmFallback")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} variant="brand-secondary">
              {t("cancel")}
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
                    toast.success(t(`message.${result.messageKey}`))
                    setRefreshKey((current) => current + 1)
                    setPendingDestructive(null)
                  })
                  .catch(() => toast.error(t("actionFailed")))
                  .finally(() => setSaving(false))
              }}
              variant="destructive"
            >
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              {saving ? t("applying") : t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
