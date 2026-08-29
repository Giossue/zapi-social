"use client"

import type { FormEvent, ReactNode } from "react"

import {
  CircleAlert,
  Download,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldX,
  Trash2,
} from "lucide-react"

import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { PageLoading } from "@/components/page-loading"
import { TablePagination } from "@/components/table-pagination"
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
import {
  Sheet,
  SheetActions,
  SheetContent,
  SheetDescription,
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
import { Textarea } from "@workspace/ui/components/textarea"
import { TimePicker } from "@workspace/ui/components/time-picker"
import { useTranslations } from "next-intl"

const historyStatusOptions = [
  "all",
  "queued",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
] as const

const historyKindOptions = [
  "all",
  "content",
  "image",
  "video",
  "repurpose",
  "planner",
  "review",
  "timing",
  "search",
  "ai_publishing",
] as const

const automationStatusOptions = ["all", "active", "paused", "draft"] as const

const creditTypeOptions = [
  "all",
  "grant",
  "debit",
  "refund",
  "adjustment",
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
  const t = useTranslations("aiStudio.operations")

  if (state === "loading") {
    return <PageLoading aria-label={t("loadingRecords")} />
  }

  if (state === "error") {
    return (
      <EmptyState
        action={
          <Button onClick={onRetry} type="button" variant="brand-secondary">
            <RefreshCw aria-hidden="true" data-icon="inline-start" />
            {t("retry")}
          </Button>
        }
        description={errorDescription}
        icon={CircleAlert}
        title={t("loadFailedTitle")}
      />
    )
  }

  if (state === "forbidden") {
    return (
      <EmptyState
        description={forbiddenDescription}
        icon={ShieldX}
        title={t("forbiddenTitle")}
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
  const t = useTranslations("aiStudio.operations")

  return (
    <TablePagination
      canGoNext={page * pageSize < total}
      canGoPrevious={page > 1}
      itemLabel={t("records")}
      onNextPage={onNextPage}
      onPreviousPage={onPreviousPage}
      rangeEnd={Math.min(page * pageSize, total)}
      rangeStart={total ? (page - 1) * pageSize + 1 : 0}
      total={total}
    />
  )
}

function HistoryStatusBadge({ status }: { status: AiHistoryStatus }) {
  const t = useTranslations("aiStudio.operations")
  const label = t(`historyStatusBadge.${status}`)

  if (status === "succeeded") return <Badge variant="success">{label}</Badge>
  if (status === "failed") return <Badge variant="destructive">{label}</Badge>
  return <Badge variant="secondary">{label}</Badge>
}

function AutomationStatusBadge({ status }: { status: AiAutomationStatus }) {
  const t = useTranslations("aiStudio.operations")
  const label = t(`automationStatusBadge.${status}`)

  if (status === "active") return <Badge variant="success">{label}</Badge>
  if (status === "paused") return <Badge variant="warning">{label}</Badge>
  return <Badge variant="secondary">{label}</Badge>
}

function CreditTypeBadge({ type }: { type: AiCreditMovementType }) {
  const t = useTranslations("aiStudio.operations")
  const label = t(`creditTypeBadge.${type}`)

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
  const t = useTranslations("aiStudio.operations")
  return (
    <div className="flex flex-col gap-6">
      <OperationsHeader
        description={t("history.pageDescription")}
        title={t("history.pageTitle")}
      />
      <CollectionHeader
        description={t("history.description")}
        level="h2"
        title={t("history.title")}
      />
      <Card variant="subtle">
        <DataTableHeader
          action={action}
          search={{
            ariaLabel: t("history.searchLabel"),
            onChange: onQueryChange,
            placeholder: t("history.searchPlaceholder"),
            value: query,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <DataTableToolbar>
            <DataTableFilter
              ariaLabel={t("history.filterStatusLabel")}
              label={t("status")}
              onValueChange={onStatusFilterChange}
              options={historyStatusOptions.map((value) => ({
                label: t(`historyStatus.${value}`),
                value,
              }))}
              value={statusFilter}
            />
            <DataTableFilter
              ariaLabel={t("history.filterKindLabel")}
              label={t("tool")}
              onValueChange={onKindFilterChange}
              options={historyKindOptions.map((value) => ({
                label: t(`kind.${value}`),
                value,
              }))}
              value={kindFilter}
            />
          </DataTableToolbar>

          <CollectionState
            errorDescription={t("history.errorDescription")}
            forbiddenDescription={t("history.forbiddenDescription")}
            onRetry={onRetry}
            state={state}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("history.generation")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("tool")}
                  </TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("spend")}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("date")}
                  </TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
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
                    <TableCell className="hidden md:table-cell">
                      {row.kind}
                    </TableCell>
                    <TableCell>
                      <HistoryStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {row.cost}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {row.date}
                    </TableCell>
                    <TableCell className="text-right">
                      {renderActions(row)}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableEmptyRow
                    colSpan={6}
                    action={
                      hasFilters ? (
                        <Button
                          onClick={onClearFilters}
                          type="button"
                          variant="brand-secondary"
                        >
                          {t("clearFilters")}
                        </Button>
                      ) : undefined
                    }
                    description={
                      hasFilters
                        ? t("history.emptyFilteredDescription")
                        : t("history.emptyDescription")
                    }
                    title={
                      hasFilters ? t("noResults") : t("history.emptyTitle")
                    }
                  />
                ) : null}
              </TableBody>
            </Table>
            <CollectionPagination
              onNextPage={onNextPage}
              onPreviousPage={onPreviousPage}
              page={page}
              pageSize={pageSize}
              total={total}
            />
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
  onFormOpenChange: (open: boolean) => void
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
  onFormOpenChange,
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
  const t = useTranslations("aiStudio.operations")
  const canSubmit = Boolean(name.trim() && prompt.trim() && time && accountId)
  let emptyDescription = t("automation.needsAccount")

  if (accounts.length) emptyDescription = t("automation.emptyDescription")
  if (!canManage) emptyDescription = t("automation.noneAvailable")
  if (hasFilters) emptyDescription = t("automation.emptyFilteredDescription")

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description={t("automation.pageDescription")}
        title={t("automation.pageTitle")}
      />

      <Sheet
        onOpenChange={(open) => {
          if (!pendingCreate) onFormOpenChange(open)
        }}
        open={formOpen && canManage}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
          <SheetHeader className="border-b">
            <SheetTitle>{t("automation.createTitle")}</SheetTitle>
            <SheetDescription>
              {t("automation.createDescription")}
            </SheetDescription>
          </SheetHeader>
          <form
            aria-busy={pendingCreate}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={onSubmit}
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <FieldGroup>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field data-disabled={pendingCreate || undefined}>
                    <FieldLabel htmlFor="automation-name">
                      {t("name")}
                      <RequiredMark />
                    </FieldLabel>
                    <Input
                      aria-required="true"
                      disabled={pendingCreate}
                      id="automation-name"
                      onChange={(event) => onNameChange(event.target.value)}
                      value={name}
                    />
                  </Field>
                  <Field data-disabled={pendingCreate || undefined}>
                    <FieldLabel htmlFor="automation-time">
                      {t("timeColumn")} <RequiredMark />
                    </FieldLabel>
                    <TimePicker
                      aria-required={true}
                      disabled={pendingCreate}
                      id="automation-time"
                      onValueChange={onTimeChange}
                      value={time}
                    />
                  </Field>
                </FieldGroup>
                <Field data-disabled={pendingCreate || undefined}>
                  <FieldLabel htmlFor="automation-prompt">
                    {t("automation.prompt")} <RequiredMark />
                  </FieldLabel>
                  <Textarea
                    aria-required="true"
                    disabled={pendingCreate}
                    id="automation-prompt"
                    onChange={(event) => onPromptChange(event.target.value)}
                    rows={4}
                    value={prompt}
                  />
                </Field>
                <Field data-disabled={pendingCreate || undefined}>
                  <FieldLabel htmlFor="automation-account">
                    {t("automation.targetAccount")} <RequiredMark />
                  </FieldLabel>
                  <Select
                    disabled={pendingCreate}
                    onValueChange={onAccountIdChange}
                    value={accountId}
                  >
                    <SelectTrigger
                      aria-required="true"
                      className="w-full"
                      id="automation-account"
                    >
                      <SelectValue
                        placeholder={t("automation.selectAccount")}
                      />
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
                      {t("automation.noAccounts")}
                    </FieldDescription>
                  ) : null}
                </Field>
              </FieldGroup>
            </div>
            <SheetActions>
              <Button
                disabled={pendingCreate}
                onClick={() => onFormOpenChange(false)}
                type="button"
                variant="brand-secondary"
              >
                {t("cancel")}
              </Button>
              <Button disabled={pendingCreate || !canSubmit} type="submit">
                {pendingCreate ? (
                  <Spinner
                    aria-label={t("automation.saving")}
                    data-icon="inline-start"
                  />
                ) : (
                  <Save aria-hidden="true" data-icon="inline-start" />
                )}
                {pendingCreate ? t("saving") : t("automation.save")}
              </Button>
            </SheetActions>
          </form>
        </SheetContent>
      </Sheet>

      <Card variant="subtle">
        <DataTableHeader
          action={
            canManage ? (
              <Button
                className="hidden sm:inline-flex"
                disabled={state !== "ready"}
                onClick={() => onFormOpenChange(true)}
                size="sm"
                type="button"
              >
                <Plus aria-hidden="true" data-icon="inline-start" />
                {t("automation.create")}
              </Button>
            ) : undefined
          }
          search={{
            ariaLabel: t("automation.searchLabel"),
            onChange: onQueryChange,
            placeholder: t("automation.searchPlaceholder"),
            value: query,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <DataTableToolbar>
            <DataTableFilter
              ariaLabel={t("automation.filterStatusLabel")}
              label={t("status")}
              onValueChange={onStatusFilterChange}
              options={automationStatusOptions.map((value) => ({
                label: t(`automationStatus.${value}`),
                value,
              }))}
              value={statusFilter}
            />
          </DataTableToolbar>

          <CollectionState
            errorDescription={t("automation.errorDescription")}
            forbiddenDescription={t("automation.forbiddenDescription")}
            onRetry={onRetry}
            state={state}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("automation.rule")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("automation.frequencyColumn")}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("automation.nextRunColumn")}
                  </TableHead>
                  <TableHead>{t("status")}</TableHead>
                  {canManage ? (
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const busy = busyRowId === row.id

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {row.cadence}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {row.nextRun}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AutomationStatusBadge status={row.status} />
                          {canManage ? (
                            <Switch
                              aria-label={t("enableAutomation", {
                                name: row.name,
                              })}
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
                                aria-label={t("rowActions", { name: row.name })}
                                disabled={busy}
                                size="icon-sm"
                                variant="brand-secondary"
                              >
                                {busy ? (
                                  <Spinner aria-label={t("processing")} />
                                ) : (
                                  <MoreHorizontal aria-hidden="true" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" size="compact">
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onSelect={() => onRun(row)}
                                  size="compact"
                                >
                                  <Play aria-hidden="true" />
                                  {t("runNow")}
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onSelect={() => onRequestDelete(row)}
                                  size="compact"
                                  variant="destructive"
                                >
                                  <Trash2 aria-hidden="true" />
                                  {t("delete")}
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
                {rows.length === 0 ? (
                  <TableEmptyRow
                    colSpan={canManage ? 5 : 4}
                    action={
                      hasFilters ? (
                        <Button
                          onClick={onClearFilters}
                          type="button"
                          variant="brand-secondary"
                        >
                          {t("clearFilters")}
                        </Button>
                      ) : undefined
                    }
                    description={emptyDescription}
                    title={
                      hasFilters ? t("noResults") : t("automation.emptyTitle")
                    }
                  />
                ) : null}
              </TableBody>
            </Table>
            <CollectionPagination
              onNextPage={onNextPage}
              onPreviousPage={onPreviousPage}
              page={page}
              pageSize={pageSize}
              total={total}
            />
          </CollectionState>
        </CardContent>
      </Card>

      {canManage ? (
        <FloatingActionButton
          disabled={state !== "ready"}
          label={t("automation.create")}
          onClick={() => onFormOpenChange(true)}
        />
      ) : null}

      <AlertDialog
        onOpenChange={onDeleteOpenChange}
        open={pendingDelete !== null}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("automation.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("automation.deleteDescriptionNamed", {
                name: pendingDelete?.name ?? t("automation.deleteFallbackName"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} variant="brand-secondary">
              {t("cancel")}
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
                  aria-label={t("automation.deleting")}
                  data-icon="inline-start"
                />
              ) : (
                <Trash2 aria-hidden="true" data-icon="inline-start" />
              )}
              {deleting ? t("deleting") : t("delete")}
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
  budget: string
  budgetEditable: boolean
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
  state: AiOperationalViewState
  tableAction?: ReactNode
}

function AiCreditsSurface({
  alertPercent,
  alertsEnabled,
  budget,
  budgetEditable,
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
  state,
  tableAction,
  total,
}: AiCreditsSurfaceProps) {
  const t = useTranslations("aiStudio.operations")
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
        description={t("credits.pageDescription")}
        title={t("credits.pageTitle")}
      />

      {state === "ready" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex flex-col gap-4">
              <Card variant="subtle">
                <DataTableHeader
                  action={tableAction}
                  search={{
                    ariaLabel: t("credits.searchLabel"),
                    onChange: onQueryChange,
                    placeholder: t("credits.searchPlaceholder"),
                    value: query,
                  }}
                />
                <CardContent className="flex flex-col gap-4 px-0">
                  <DataTableToolbar>
                    <DataTableFilter
                      ariaLabel={t("credits.filterTypeLabel")}
                      label={t("type")}
                      onValueChange={onMovementTypeChange}
                      options={creditTypeOptions.map((value) => ({
                        label: t(`creditType.${value}`),
                        value,
                      }))}
                      value={movementType}
                    />
                  </DataTableToolbar>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>{t("credits.movement")}</TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t("credits.detailColumn")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("credits.creditsColumn")}
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
                          <TableCell className="hidden md:table-cell">
                            {movement.detail}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {movement.credits}
                          </TableCell>
                        </TableRow>
                      ))}
                      {movements.length === 0 ? (
                        <TableEmptyRow
                          colSpan={4}
                          action={
                            hasFilters ? (
                              <Button
                                onClick={onClearFilters}
                                type="button"
                                variant="brand-secondary"
                              >
                                {t("clearFilters")}
                              </Button>
                            ) : undefined
                          }
                          description={
                            hasFilters
                              ? t("credits.emptyFilteredDescription")
                              : t("credits.emptyDescription")
                          }
                          title={
                            hasFilters
                              ? t("noResults")
                              : t("credits.emptyTitle")
                          }
                        />
                      ) : null}
                    </TableBody>
                  </Table>
                  <CollectionPagination
                    onNextPage={onNextPage}
                    onPreviousPage={onPreviousPage}
                    page={page}
                    pageSize={pageSize}
                    total={total}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card variant="subtle">
                <CardHeader>
                  <CardTitle>{t("credits.budgetTitle")}</CardTitle>
                  <CardDescription>
                    {budgetEditable
                      ? t("credits.budgetHint")
                      : t("credits.budgetReadOnly")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form noValidate onSubmit={onSaveBudget}>
                    <FieldGroup>
                      <Field data-disabled={!budgetEditable || pendingBudget}>
                        <FieldLabel htmlFor="ai-monthly-budget">
                          {t("credits.budgetLimit")}
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
                          {t("credits.alertThreshold")} <RequiredMark />
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
                          {t("activeAlerts")}
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
                            aria-label={t("credits.savingBudget")}
                            data-icon="inline-start"
                          />
                        ) : (
                          <Save aria-hidden="true" data-icon="inline-start" />
                        )}
                        {pendingBudget ? t("saving") : t("credits.saveBudget")}
                      </Button>
                    </FieldGroup>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
      ) : (
        <Card variant="subtle">
          <CollectionState
            errorDescription={t("credits.errorDescription")}
            forbiddenDescription={t("credits.forbiddenDescription")}
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
  DownloadTableButton,
}
