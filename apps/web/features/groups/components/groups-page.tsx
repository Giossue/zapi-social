"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import {
  CircleAlert,
  FolderKanban,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react"

import { ApiError, groupsApi } from "@workspace/api-client"
import type {
  PortalAccountGroup,
  PortalGroupsResponse,
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
import { Checkbox } from "@workspace/ui/components/checkbox"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { useChannelLabels } from "@/lib/channel-labels"
import { loginPath } from "@/features/identity/login-redirect"

const pageSize = 10

type GroupStatus = PortalAccountGroup["status"]
type GroupAccount = PortalGroupsResponse["accounts"][number]

const statusVariant: Record<GroupStatus, "success" | "neutral"> = {
  active: "success",
  inactive: "neutral",
}

/** Paleta fija para que un grupo sea reconocible de un vistazo sin abrir un selector nativo. */
const groupColors = [
  { labelKey: "color.blue", value: "#2563eb" },
  { labelKey: "color.green", value: "#16a34a" },
  { labelKey: "color.amber", value: "#d97706" },
  { labelKey: "color.red", value: "#dc2626" },
  { labelKey: "color.violet", value: "#7c3aed" },
  { labelKey: "color.gray", value: "#475569" },
] as const

type GroupDraft = {
  name: string
  description: string
  color: string
  status: GroupStatus
  accountIds: string[]
}

const emptyDraft: GroupDraft = {
  name: "",
  description: "",
  color: groupColors[0].value,
  status: "active",
  accountIds: [],
}

function draftFrom(group: PortalAccountGroup): GroupDraft {
  return {
    name: group.name,
    description: group.description,
    color: group.color,
    status: group.status,
    accountIds: [...group.accountIds],
  }
}

function GroupSheet({
  accounts,
  group,
  onOpenChange,
  onSubmit,
  open,
  pending,
}: {
  accounts: readonly GroupAccount[]
  group: PortalAccountGroup | null
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: GroupDraft) => Promise<boolean>
  open: boolean
  pending: boolean
}) {
  const t = useTranslations("groups")
  const labels = useChannelLabels()
  const [draft, setDraft] = useState<GroupDraft>(emptyDraft)

  useEffect(() => {
    if (open) setDraft(group ? draftFrom(group) : emptyDraft)
  }, [group, open])

  const canSubmit = Boolean(draft.name.trim())

  function toggleAccount(id: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      accountIds: checked
        ? [...current.accountIds, id]
        : current.accountIds.filter((accountId) => accountId !== id),
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error(t("nameRequired"))
      return
    }
    const saved = await onSubmit({ ...draft, name: draft.name.trim() })
    if (saved) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{group ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>
            Un grupo organiza cuentas conectadas; no modifica permisos ni
            miembros del equipo.
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
                <FieldLabel htmlFor="group-name">
                  Nombre{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={pending}
                  id="group-name"
                  maxLength={120}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder={t("namePlaceholder")}
                  value={draft.name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="group-description">
                  {t("description")}
                </FieldLabel>
                <Textarea
                  disabled={pending}
                  id="group-description"
                  maxLength={1000}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder={t("descriptionPlaceholder")}
                  rows={3}
                  value={draft.description}
                />
              </Field>
              <Field>
                <FieldLabel>{t("color.label")}</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {groupColors.map((color) => (
                    <Button
                      aria-label={t(color.labelKey)}
                      aria-pressed={draft.color === color.value}
                      disabled={pending}
                      key={color.value}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          color: color.value,
                        }))
                      }
                      size="icon-sm"
                      type="button"
                      variant={
                        draft.color === color.value
                          ? "brand-secondary"
                          : "surface"
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="size-3.5 rounded-full"
                        style={{ backgroundColor: color.value }}
                      />
                    </Button>
                  ))}
                </div>
                <FieldDescription>{t("colorHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="group-status">{t("status")}</FieldLabel>
                <Select
                  disabled={pending}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      status: value as GroupStatus,
                    }))
                  }
                  value={draft.status}
                >
                  <SelectTrigger className="w-full" id="group-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">
                        {t("statusLabel.active")}
                      </SelectItem>
                      <SelectItem value="inactive">
                        {t("statusLabel.inactive")}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <FieldSet>
                <FieldLabel asChild>
                  <legend>{t("accounts")}</legend>
                </FieldLabel>
                {accounts.length ? (
                  <FieldGroup className="gap-3" data-slot="checkbox-group">
                    {accounts.map((account) => {
                      const controlId = `group-account-${account.id}`
                      return (
                        <Field key={account.id} orientation="horizontal">
                          <Checkbox
                            checked={draft.accountIds.includes(account.id)}
                            disabled={pending}
                            id={controlId}
                            onCheckedChange={(value) =>
                              toggleAccount(account.id, value === true)
                            }
                          />
                          <FieldLabel htmlFor={controlId}>
                            <FieldContent>
                              <FieldTitle>{account.displayName}</FieldTitle>
                              <FieldDescription>
                                {labels.capability(account.capabilityKey)}
                              </FieldDescription>
                            </FieldContent>
                          </FieldLabel>
                        </Field>
                      )
                    })}
                  </FieldGroup>
                ) : (
                  <FieldDescription>{t("noAccounts")}</FieldDescription>
                )}
              </FieldSet>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
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
                <Plus data-icon="inline-start" />
              )}
              {group ? t("save") : t("create")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function GroupsPage() {
  const t = useTranslations("groups")
  const format = useFormatter()
  const router = useRouter()
  const [data, setData] = useState<PortalGroupsResponse | null>(null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<GroupStatus | "all">("all")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [canView, setCanView] = useState(true)
  const [pending, setPending] = useState(false)
  const [page, setPage] = useState(1)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PortalAccountGroup | null>(null)
  const [toDelete, setToDelete] = useState<PortalAccountGroup | null>(null)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return true
      }
      if (error instanceof ApiError && error.status === 403) {
        setCanView(false)
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
      setData(
        await groupsApi.list({
          ...(query.trim() ? { q: query.trim() } : {}),
          ...(status === "all" ? {} : { status }),
        })
      )
      setCanView(true)
    } catch (error) {
      if (handleError(error)) return
      console.error("Groups request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError, query, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  async function saveGroup(draft: GroupDraft) {
    setPending(true)
    try {
      if (editing) {
        await groupsApi.update(editing.id, draft)
        toast.success(t("groupUpdated"))
      } else {
        await groupsApi.create(draft)
        toast.success(t("created"))
      }
      await load()
      return true
    } catch (error) {
      if (handleError(error)) return false
      console.error("Group save failed", error)
      toast.error(t("saveFailed"))
      return false
    } finally {
      setPending(false)
    }
  }

  async function removeGroup(group: PortalAccountGroup) {
    setPending(true)
    try {
      await groupsApi.remove(group.id)
      setToDelete(null)
      await load()
      toast.success(t("deleted"))
    } catch (error) {
      if (handleError(error)) return
      console.error("Group deletion failed", error)
      toast.error(t("deleteFailed"))
    } finally {
      setPending(false)
    }
  }

  if (!canView) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={LockKeyhole}
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
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
            title={t("unavailable")}
          />
        </CardContent>
      </Card>
    )
  }

  const accountsById = new Map(
    data.accounts.map((account) => [account.id, account])
  )
  const hasFilters = Boolean(query || status !== "all")
  const pageCount = Math.max(1, Math.ceil(data.groups.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleGroups = data.groups.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )
  const rangeStart = data.groups.length ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = data.groups.length
    ? rangeStart + visibleGroups.length - 1
    : 0

  function clearFilters() {
    setQuery("")
    setStatus("all")
    setPage(1)
  }

  function openCreate() {
    setEditing(null)
    setIsSheetOpen(true)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("pageDescription")}
          title={t("pageTitle")}
        />
        <CardGrid layout="xl-3">
          <MetricCard
            description={t("metrics.totalDescription")}
            icon={FolderKanban}
            label={t("pageTitle")}
            value={data.metrics.total}
          />
          <MetricCard
            description={t("metrics.activeDescription")}
            icon={FolderKanban}
            label={t("metrics.active")}
            value={data.metrics.active}
          />
          <MetricCard
            description={t("metrics.reachedDescription")}
            icon={Share2}
            label={t("metrics.reached")}
            value={data.metrics.reachedAccounts}
          />
        </CardGrid>
        <Card variant="subtle">
          <DataTableHeader
            action={
              data.canManage ? (
                <Button
                  className="hidden sm:inline-flex"
                  onClick={openCreate}
                  size="sm"
                  type="button"
                >
                  <Plus data-icon="inline-start" /> Nuevo grupo
                </Button>
              ) : undefined
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
                    onClick={clearFilters}
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
                ariaLabel={t("filterStatus")}
                label={t("status")}
                onValueChange={(value) => {
                  setStatus(value as GroupStatus | "all")
                  setPage(1)
                }}
                options={[
                  { label: t("filter.all"), value: "all" },
                  { label: t("filter.active"), value: "active" },
                  { label: t("filter.inactive"), value: "inactive" },
                ]}
                value={status}
              />
            </DataTableToolbar>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("group")}</TableHead>
                  <TableHead>{t("accounts")}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("updated")}
                  </TableHead>
                  <TableHead>{t("status")}</TableHead>
                  {data.canManage ? (
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleGroups.length ? (
                  visibleGroups.map((group) => {
                    const names = group.accountIds
                      .map((id) => accountsById.get(id)?.displayName)
                      .filter(Boolean)
                    return (
                      <TableRow key={group.id}>
                        <TableCell>
                          <div className="flex min-w-48 items-start gap-2">
                            <span
                              aria-hidden="true"
                              className="mt-1.5 size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: group.color }}
                            />
                            <div className="flex min-w-0 flex-col">
                              <span className="font-medium">{group.name}</span>
                              {group.description ? (
                                <span className="text-sm text-muted-foreground">
                                  {group.description}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>
                              {t("accountCount", {
                                count: group.accountIds.length,
                              })}
                            </span>
                            {names.length ? (
                              <span className="text-sm text-muted-foreground">
                                {names.slice(0, 2).join(", ")}
                                {names.length > 2
                                  ? t("andMore", { count: names.length - 2 })
                                  : ""}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {format.dateTime(new Date(group.updatedAt), {
                            dateStyle: "medium",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[group.status]}>
                            {t(`statusLabel.${group.status}`)}
                          </Badge>
                        </TableCell>
                        {data.canManage ? (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  aria-label={t("openActions", {
                                    name: group.name,
                                  })}
                                  className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                                  size="icon-sm"
                                  variant="brand-secondary"
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" size="compact">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setEditing(group)
                                    setIsSheetOpen(true)
                                  }}
                                  size="compact"
                                >
                                  <Pencil />
                                  {t("edit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => setToDelete(group)}
                                  size="compact"
                                  variant="destructive"
                                >
                                  <Trash2 />
                                  {t("delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })
                ) : (
                  <TableEmptyRow
                    action={
                      hasFilters ? (
                        <Button onClick={clearFilters} variant="outline">
                          {t("clearFilters")}
                        </Button>
                      ) : null
                    }
                    colSpan={data.canManage ? 5 : 4}
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
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel={t("itemLabel")}
              onNextPage={() =>
                setPage((current) => Math.min(current + 1, pageCount))
              }
              onPreviousPage={() =>
                setPage((current) => Math.max(current - 1, 1))
              }
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              total={data.groups.length}
            />
          </CardContent>
        </Card>
        {data.canManage ? (
          <FloatingActionButton label={t("createTitle")} onClick={openCreate} />
        ) : null}
      </div>
      <GroupSheet
        accounts={data.accounts}
        group={editing}
        onOpenChange={setIsSheetOpen}
        onSubmit={saveGroup}
        open={isSheetOpen}
        pending={pending}
      />
      <AlertDialog
        onOpenChange={(open) => !open && setToDelete(null)}
        open={Boolean(toDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteTitle", { name: toDelete?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
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
                if (toDelete) void removeGroup(toDelete)
              }}
              variant="destructive"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t("deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
