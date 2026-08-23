"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  Bell,
  BellRing,
  EllipsisVertical,
  Eye,
  FileText,
  Megaphone,
  Pencil,
  Plus,
  Send,
  ShieldX,
  Target,
  Trash2,
  X,
} from "lucide-react"

import { adminNotificationsApi, ApiError } from "@workspace/api-client"
import type {
  AdminAnnouncement,
  AdminAnnouncementMetrics,
  AnnouncementAudience,
  UpsertAdminAnnouncementInput,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
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
import { TablePagination } from "@/components/table-pagination"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"

const emptyMetrics: AdminAnnouncementMetrics = {
  published: 0,
  drafts: 0,
  targeted: 0,
  reads: 0,
}

const pageSize = 10

type FormValues = {
  title: string
  body: string
  url: string
  audience: AnnouncementAudience
  targetId: string
}

const emptyForm: FormValues = {
  title: "",
  body: "",
  url: "",
  audience: "all",
  targetId: "",
}

function AnnouncementSheet({
  editing,
  onOpenChange,
  onSubmit,
  open,
  pending,
}: {
  editing: AdminAnnouncement | null
  onOpenChange: (open: boolean) => void
  onSubmit: (values: UpsertAdminAnnouncementInput) => Promise<boolean>
  open: boolean
  pending: boolean
}) {
  const t = useTranslations("adminNotifications")
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [targetQuery, setTargetQuery] = useState("")
  const [targets, setTargets] = useState<{ id: string; label: string }[]>([])

  useEffect(() => {
    if (!open) return
    setValues(
      editing
        ? {
            title: editing.title,
            body: editing.body,
            url: editing.url ?? "",
            audience: editing.audience,
            targetId: editing.targetWorkspaceId ?? editing.targetUserId ?? "",
          }
        : emptyForm
    )
    setTargetQuery("")
  }, [editing, open])

  useEffect(() => {
    if (!open || values.audience === "all") {
      setTargets([])
      return
    }
    let isCurrent = true
    const timer = setTimeout(
      () => {
        void adminNotificationsApi
          .targets(targetQuery.trim() || undefined)
          .then((response) => {
            if (!isCurrent) return
            setTargets(
              values.audience === "workspace"
                ? response.workspaces
                : response.users
            )
          })
          .catch((error: unknown) => {
            console.error("Announcement targets request failed", error)
          })
      },
      targetQuery ? 300 : 0
    )
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [open, targetQuery, values.audience])

  const needsTarget = values.audience !== "all"
  const canSubmit = Boolean(
    values.title.trim() &&
    values.body.trim() &&
    (!needsTarget || values.targetId)
  )

  function close() {
    setValues(emptyForm)
    onOpenChange(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>, publish: boolean) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error(t("missingFields"))
      return
    }
    const saved = await onSubmit({
      title: values.title.trim(),
      body: values.body.trim(),
      url: values.url.trim() || undefined,
      audience: values.audience,
      targetWorkspaceId:
        values.audience === "workspace" ? values.targetId : null,
      targetUserId: values.audience === "user" ? values.targetId : null,
      publish,
    })
    if (saved) close()
  }

  return (
    <Sheet
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      open={open}
    >
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{editing ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>
            Los anuncios publicados aparecen en la campana del Portal de sus
            destinatarios.
          </SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          id="announcement-form"
          noValidate
          onSubmit={(event) => void submit(event, true)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="announcement-title">
                  Título{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="announcement-title"
                  maxLength={200}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder={t("titlePlaceholder")}
                  value={values.title}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="announcement-body">
                  Mensaje{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Textarea
                  aria-required="true"
                  id="announcement-body"
                  maxLength={5000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  placeholder={t("bodyPlaceholder")}
                  rows={6}
                  value={values.body}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="announcement-url">{t("link")}</FieldLabel>
                <Input
                  id="announcement-url"
                  maxLength={2048}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      url: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  value={values.url}
                />
                <FieldDescription>{t("linkHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="announcement-audience">
                  {t("audienceLabel")}
                </FieldLabel>
                <Select
                  onValueChange={(audience) =>
                    setValues((current) => ({
                      ...current,
                      audience: audience as AnnouncementAudience,
                      targetId: "",
                    }))
                  }
                  value={values.audience}
                >
                  <SelectTrigger className="w-full" id="announcement-audience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">
                        {t("audienceOption.all")}
                      </SelectItem>
                      <SelectItem value="workspace">
                        {t("audienceOption.workspace")}
                      </SelectItem>
                      <SelectItem value="user">
                        {t("audienceOption.user")}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {needsTarget ? (
                <Field>
                  <FieldLabel htmlFor="announcement-target">
                    Destinatario{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                    <span className="sr-only"> {t("required")}</span>
                  </FieldLabel>
                  <Input
                    aria-label={t("searchTarget")}
                    onChange={(event) => setTargetQuery(event.target.value)}
                    placeholder={
                      values.audience === "workspace"
                        ? t("searchWorkspace")
                        : t("searchPerson")
                    }
                    value={targetQuery}
                  />
                  <Select
                    onValueChange={(targetId) =>
                      setValues((current) => ({ ...current, targetId }))
                    }
                    value={values.targetId}
                  >
                    <SelectTrigger
                      aria-required="true"
                      className="w-full"
                      id="announcement-target"
                    >
                      <SelectValue placeholder={t("selectTarget")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {targets.map((target) => (
                          <SelectItem key={target.id} value={target.id}>
                            {target.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Se muestran hasta 10 coincidencias; afina la búsqueda si no
                    aparece.
                  </FieldDescription>
                </Field>
              ) : null}
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              disabled={pending}
              onClick={close}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={!canSubmit || pending}
              onClick={(event) =>
                void submit(
                  event as unknown as FormEvent<HTMLFormElement>,
                  false
                )
              }
              type="button"
              variant="brand-secondary"
            >
              {t("saveDraft")}
            </Button>
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              Publicar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AdminNotificationsPage() {
  const t = useTranslations("adminNotifications")
  const format = useFormatter()
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([])
  const [metrics, setMetrics] = useState<AdminAnnouncementMetrics>(emptyMetrics)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | "draft" | "published">("all")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null)
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState<AdminAnnouncement | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const response = await adminNotificationsApi.list({
        limit: pageSize,
        page,
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(status === "all" ? {} : { status }),
      })
      setAnnouncements(response.announcements)
      setMetrics(response.metrics)
      setTotal(response.total)
      setForbidden(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error("Admin announcements request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [page, query, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = total ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = total ? rangeStart + announcements.length - 1 : 0
  const hasFilters = Boolean(query || status !== "all")

  async function save(values: UpsertAdminAnnouncementInput) {
    setPending(true)
    try {
      if (editing) await adminNotificationsApi.update(editing.id, values)
      else await adminNotificationsApi.create(values)
      await load()
      toast.success(values.publish ? t("published") : t("draftSaved"))
      return true
    } catch (error) {
      console.error("Announcement save failed", error)
      toast.error(t("saveFailed"))
      return false
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    if (!deleting) return
    setPending(true)
    try {
      await adminNotificationsApi.remove(deleting.id)
      setDeleting(null)
      await load()
      toast.success(t("deleted"))
    } catch (error) {
      console.error("Announcement delete failed", error)
      toast.error(t("deleteFailed"))
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

  if (isLoading && !announcements.length && !loadError) {
    return <PageLoading aria-label={t("loading")} />
  }

  if (loadError) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description={t("loadFailedDescription")}
        icon={Megaphone}
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
        <CardGrid>
          <MetricCard
            description={t("metrics.publishedDescription")}
            icon={BellRing}
            label={t("metrics.published")}
            value={metrics.published}
          />
          <MetricCard
            description={t("metrics.draftsDescription")}
            icon={FileText}
            label={t("metrics.drafts")}
            value={metrics.drafts}
          />
          <MetricCard
            description={t("metrics.targetedDescription")}
            icon={Target}
            label={t("metrics.targeted")}
            value={metrics.targeted}
          />
          <MetricCard
            description={t("metrics.readsDescription")}
            icon={Eye}
            label={t("metrics.reads")}
            value={metrics.reads}
          />
        </CardGrid>
        <Card variant="subtle">
          <DataTableHeader
            action={
              <Button
                className="hidden sm:inline-flex"
                onClick={() => {
                  setEditing(null)
                  setSheetOpen(true)
                }}
                size="sm"
                type="button"
              >
                <Plus data-icon="inline-start" /> {t("createTitle")}
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
                  setStatus(value as "all" | "draft" | "published")
                  setPage(1)
                }}
                options={[
                  { label: t("all"), value: "all" },
                  { label: t("filter.published"), value: "published" },
                  { label: t("filter.draft"), value: "draft" },
                ]}
                value={status}
              />
            </DataTableToolbar>
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("announcement")}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("audienceLabel")}
                    </TableHead>
                    <TableHead>{t("statusColumn")}</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("reads")}
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("createdColumn")}
                    </TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.length ? (
                    announcements.map((announcement) => (
                      <TableRow key={announcement.id}>
                        <TableCell>
                          <div className="flex min-w-48 flex-col gap-1">
                            <span className="font-medium">
                              {announcement.title}
                            </span>
                            <span className="line-clamp-1 text-sm text-muted-foreground">
                              {announcement.body}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {t(`audience.${announcement.audience}`)}
                          {announcement.targetLabel
                            ? ` · ${announcement.targetLabel}`
                            : ""}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              announcement.status === "published"
                                ? "success"
                                : "secondary"
                            }
                          >
                            {announcement.status === "published"
                              ? t("status.published")
                              : t("status.draft")}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {announcement.readCount}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {format.dateTime(new Date(announcement.createdAt), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-label={`Acciones de ${announcement.title}`}
                                size="icon-sm"
                                variant="brand-secondary"
                              >
                                <EllipsisVertical />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditing(announcement)
                                  setSheetOpen(true)
                                }}
                              >
                                <Pencil /> {t("edit")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => setDeleting(announcement)}
                                variant="destructive"
                              >
                                <Trash2 /> {t("delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
              itemLabel={t("itemLabel")}
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
          label={t("createTitle")}
          onClick={() => {
            setEditing(null)
            setSheetOpen(true)
          }}
        />
      </div>
      <AnnouncementSheet
        editing={editing}
        onOpenChange={setSheetOpen}
        onSubmit={save}
        open={sheetOpen}
        pending={pending}
      />
      <AlertDialog
        onOpenChange={(open) => (open ? null : setDeleting(null))}
        open={Boolean(deleting)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { title: deleting?.title ?? "" })}
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
                void remove()
              }}
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
