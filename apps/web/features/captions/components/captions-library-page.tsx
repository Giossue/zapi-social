"use client"
"use no memo"
import type { ColumnDef, RowData } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table"
import { ApiError, captionsApi } from "@workspace/api-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { TABLE_EMPTY_ICON } from "@workspace/ui/components/table-empty-row"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
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
  SheetContent,
  SheetDescription,
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@/components/table-pagination"
import { Textarea } from "@workspace/ui/components/textarea"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"
import {
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { loginPath } from "@/features/identity/login-redirect"

import type {
  Caption,
  CaptionDraft,
  CaptionSourceType,
  CaptionStatus,
} from "@/features/captions/types/captions"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string
  }
}

type CaptionEditorValues = Omit<
  Caption,
  "id" | "notes" | "updatedAt" | "tags"
> & {
  notes: string
  tags: string
}

type CaptionTableActions = {
  onEdit: (caption: Caption) => void
  onRemove: (caption: Caption) => void
}

const emptyEditorValues: CaptionEditorValues = {
  content: "",
  name: "",
  notes: "",
  sourceType: "manual",
  status: "draft",
  tags: "",
}

function toEditorValues(caption: Caption): CaptionEditorValues {
  return {
    content: caption.content,
    name: caption.name,
    notes: caption.notes ?? "",
    sourceType: caption.sourceType,
    status: caption.status,
    tags: caption.tags.join(", "),
  }
}

function normalizeTags(value: string) {
  const uniqueTags = new Map<string, string>()

  for (const rawTag of value.split(",")) {
    const tag = rawTag.trim()
    if (tag) uniqueTags.set(tag.toLocaleLowerCase("es"), tag)
  }

  return [...uniqueTags.values()]
}

function CaptionStatusBadge({ status }: { status: CaptionStatus }) {
  const t = useTranslations("captions")

  if (status === "active") {
    return (
      <Badge
        className="bg-success leading-none text-success-foreground"
        variant="secondary"
      >
        {t(`statusLabel.${status}`)}
      </Badge>
    )
  }

  return (
    <Badge className="leading-none" variant="outline">
      {t(`statusLabel.${status}`)}
    </Badge>
  )
}

function CaptionCell({ caption }: { caption: Caption }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium text-foreground">
        {caption.name}
      </div>
      <div className="max-w-md truncate text-sm text-muted-foreground">
        {caption.content}
      </div>
    </div>
  )
}

function SourceCell({ sourceType }: { sourceType: CaptionSourceType }) {
  const t = useTranslations("captions")

  return (
    <Badge className="leading-none" variant="outline">
      {t(`sourceLabel.${sourceType}`)}
    </Badge>
  )
}

function TagsCell({ tags }: { tags: readonly string[] }) {
  const visibleTags = tags.slice(0, 2)
  const hiddenTagCount = tags.length - visibleTags.length

  return (
    <div className="flex max-w-48 flex-wrap gap-1">
      {visibleTags.map((tag) => (
        <Badge className="leading-none" key={tag} variant="outline">
          {tag}
        </Badge>
      ))}
      {hiddenTagCount > 0 ? (
        <Badge className="leading-none" variant="outline">
          +{hiddenTagCount}
        </Badge>
      ) : null}
    </div>
  )
}

function createCaptionColumns({
  onEdit,
  onRemove,
  t,
  format,
}: CaptionTableActions & {
  t: ReturnType<typeof useTranslations<"captions">>
  format: ReturnType<typeof useFormatter>
}): ColumnDef<Caption>[] {
  return [
    {
      accessorKey: "name",
      header: t("caption"),
      cell: ({ row }) => <CaptionCell caption={row.original} />,
    },
    {
      accessorKey: "sourceType",
      header: t("source"),
      cell: ({ row }) => <SourceCell sourceType={row.original.sourceType} />,
      meta: { className: "hidden md:table-cell" },
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => <CaptionStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "tags",
      header: t("tags"),
      cell: ({ row }) => <TagsCell tags={row.original.tags} />,
      meta: { className: "hidden lg:table-cell" },
    },
    {
      accessorKey: "updatedAt",
      header: t("updated"),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {Number.isNaN(new Date(row.original.updatedAt).getTime())
            ? t("updatedRecently")
            : format.dateTime(new Date(row.original.updatedAt), {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
        </span>
      ),
      meta: { className: "hidden lg:table-cell" },
    },
    {
      id: "actions",
      header: () => <div className="text-right">{t("actions")}</div>,
      cell: ({ row }) => {
        const caption = row.original

        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t("openActions", { name: caption.name })}
                  size="icon-sm"
                  type="button"
                  variant="brand-secondary"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" size="compact">
                <DropdownMenuItem
                  onSelect={() => onEdit(caption)}
                  size="compact"
                >
                  <Pencil />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onRemove(caption)}
                  size="compact"
                  variant="destructive"
                >
                  <Trash2 />
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      enableHiding: false,
      enableSorting: false,
    },
  ]
}

function CaptionsTable({
  captions,
  emptyState,
  onEdit,
  onRemove,
}: {
  captions: readonly Caption[]
  emptyState: ReactNode
  onEdit: (caption: Caption) => void
  onRemove: (caption: Caption) => void
}) {
  const t = useTranslations("captions")
  const format = useFormatter()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const tableData = useMemo(() => [...captions], [captions])
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tableData,
    columns: createCaptionColumns({ format, onEdit, onRemove, t }),
    state: { pagination },
    getRowId: (caption) => caption.id,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })
  const total = captions.length
  const rangeStart = total ? pagination.pageIndex * pagination.pageSize + 1 : 0
  const rangeEnd = total
    ? Math.min(rangeStart + table.getRowModel().rows.length - 1, total)
    : 0

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={header.column.columnDef.meta?.className}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className={cell.column.columnDef.meta?.className}
                      key={cell.id}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length}>
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        canGoNext={table.getCanNextPage()}
        canGoPrevious={table.getCanPreviousPage()}
        itemLabel={t("itemLabel")}
        onNextPage={() => table.nextPage()}
        onPreviousPage={() => table.previousPage()}
        rangeEnd={rangeEnd}
        rangeStart={rangeStart}
        total={total}
      />
    </div>
  )
}

function CaptionsLoading() {
  return <PageLoading />
}

export function CaptionsLibraryPage() {
  const t = useTranslations("captions")
  const router = useRouter()
  const [captions, setCaptions] = useState<Caption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadError, setHasLoadError] = useState(false)
  const [hasPermission, setHasPermission] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sourceFilter, setSourceFilter] = useState<CaptionSourceType | "all">(
    "all"
  )
  const [statusFilter, setStatusFilter] = useState<CaptionStatus | "all">("all")
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingCaption, setEditingCaption] = useState<Caption | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [captionToDelete, setCaptionToDelete] = useState<Caption | null>(null)
  const [pending, setPending] = useState(false)

  const loadCaptions = useCallback(async () => {
    setIsLoading(true)
    setHasLoadError(false)

    try {
      const response = await captionsApi.list()
      setCaptions(response.captions)
      setHasPermission(true)
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setHasPermission(false)
        return
      }

      console.error("Captions request failed", error)
      setHasLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    let isCurrent = true

    void captionsApi
      .list()
      .then((response) => {
        if (!isCurrent) return
        setCaptions(response.captions)
        setHasPermission(true)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        if (
          error instanceof ApiError &&
          error.code === "AUTH_SESSION_EXPIRED"
        ) {
          router.replace(loginPath())
          return
        }
        if (error instanceof ApiError && error.status === 403) {
          setHasPermission(false)
          return
        }

        console.error("Captions request failed", error)
        setHasLoadError(true)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [router])

  const filteredCaptions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("es")

    return captions.filter((caption) => {
      const matchesQuery =
        !normalizedQuery ||
        [caption.name, caption.content, caption.notes ?? "", ...caption.tags]
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(normalizedQuery)
      const matchesSource =
        sourceFilter === "all" || caption.sourceType === sourceFilter
      const matchesStatus =
        statusFilter === "all" || caption.status === statusFilter

      return matchesQuery && matchesSource && matchesStatus
    })
  }, [captions, searchQuery, sourceFilter, statusFilter])

  const hasActiveFilters =
    Boolean(searchQuery) || sourceFilter !== "all" || statusFilter !== "all"

  function clearFilters() {
    setSearchQuery("")
    setSourceFilter("all")
    setStatusFilter("all")
  }

  function openCreateEditor() {
    setEditingCaption(null)
    setEditorKey((currentKey) => currentKey + 1)
    setIsEditorOpen(true)
  }

  function openEditEditor(caption: Caption) {
    setEditingCaption(caption)
    setEditorKey((currentKey) => currentKey + 1)
    setIsEditorOpen(true)
  }

  async function saveCaption(values: CaptionEditorValues) {
    const name = values.name.trim()
    const content = values.content.trim()
    const tags = normalizeTags(values.tags)

    if (!name || !content) return t("requiredFields")
    if (tags.length > 20 || tags.some((tag) => tag.length > 64)) {
      return t("tagsLimit")
    }

    const draft: CaptionDraft = {
      content,
      name,
      notes: values.notes.trim() || null,
      sourceType: values.sourceType,
      status: values.status,
      tags,
    }

    setPending(true)
    try {
      if (editingCaption) {
        const updatedCaption = await captionsApi.update(
          editingCaption.id,
          draft
        )
        setCaptions((currentCaptions) =>
          currentCaptions.map((caption) =>
            caption.id === updatedCaption.id ? updatedCaption : caption
          )
        )
        toast.success(t("saved"))
      } else {
        const newCaption = await captionsApi.create(draft)
        setCaptions((currentCaptions) => [newCaption, ...currentCaptions])
        toast.success(t("created"))
      }

      setIsEditorOpen(false)
      setEditingCaption(null)
      return null
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return null
      }

      console.error("Caption save failed", error)
      toast.error(t("saveFailedToast"))
      return t("saveFailed")
    } finally {
      setPending(false)
    }
  }

  async function deleteCaption() {
    if (!captionToDelete) return

    setPending(true)
    try {
      await captionsApi.remove(captionToDelete.id)
      setCaptions((currentCaptions) =>
        currentCaptions.filter((caption) => caption.id !== captionToDelete.id)
      )
      setCaptionToDelete(null)
      toast.success(t("deleted"))
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return
      }

      console.error("Caption delete failed", error)
      toast.error(t("deleteFailed"))
    } finally {
      setPending(false)
    }
  }

  if (isLoading) return <CaptionsLoading />

  if (!hasPermission) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={LockKeyhole}
            title={t("forbiddenTitle")}
          />
        </CardContent>
      </Card>
    )
  }

  if (hasLoadError) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={<RetryButton onClick={() => void loadCaptions()} />}
            description={t("loadFailedDescription")}
            icon={TriangleAlert}
            title={t("loadFailedTitle")}
          />
        </CardContent>
      </Card>
    )
  }

  const emptyState = hasActiveFilters ? (
    <EmptyState
      action={
        <Button onClick={clearFilters} type="button" variant="outline">
          <X data-icon="inline-start" />
          {t("clearFilters")}
        </Button>
      }
      description={t("emptyFilteredDescription")}
      icon={TABLE_EMPTY_ICON}
      title={t("noMatches")}
    />
  ) : (
    <EmptyState
      description={t("emptyDescription")}
      icon={TABLE_EMPTY_ICON}
      title={t("emptyTitle")}
    />
  )

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("pageDescription")}
          title={t("pageTitle")}
        />
        <Card variant="subtle">
          <DataTableHeader
            action={
              <Button
                className="hidden sm:inline-flex"
                onClick={openCreateEditor}
                size="sm"
                type="button"
              >
                <Plus />
                {t("createTitle")}
              </Button>
            }
            search={{
              ariaLabel: t("searchLabel"),
              onChange: setSearchQuery,
              placeholder: t("searchPlaceholder"),
              value: searchQuery,
            }}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar
              actions={
                sourceFilter !== "all" || statusFilter !== "all" ? (
                  <Button
                    onClick={clearFilters}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <X />
                    {t("clear")}
                  </Button>
                ) : undefined
              }
            >
              <DataTableFilter
                ariaLabel={t("filterSource")}
                label={t("source")}
                onValueChange={(value) =>
                  setSourceFilter(value as CaptionSourceType | "all")
                }
                options={[
                  { label: t("all"), value: "all" },
                  { label: t("sourceLabel.manual"), value: "manual" },
                  { label: t("sourceLabel.ai"), value: "ai" },
                ]}
                value={sourceFilter}
              />
              <DataTableFilter
                ariaLabel={t("filterStatus")}
                label={t("status")}
                onValueChange={(value) =>
                  setStatusFilter(value as CaptionStatus | "all")
                }
                options={[
                  { label: t("all"), value: "all" },
                  { label: t("statusLabel.active"), value: "active" },
                  { label: t("statusLabel.draft"), value: "draft" },
                  { label: t("statusLabel.archived"), value: "archived" },
                ]}
                value={statusFilter}
              />
            </DataTableToolbar>
            <CaptionsTable
              captions={filteredCaptions}
              emptyState={emptyState}
              onEdit={openEditEditor}
              onRemove={setCaptionToDelete}
            />
          </CardContent>
        </Card>
      </div>

      <FloatingActionButton
        label={t("createTitle")}
        onClick={openCreateEditor}
      />

      <CaptionEditor
        caption={editingCaption}
        key={editorKey}
        onOpenChange={(open) => {
          setIsEditorOpen(open)
          if (!open) setEditingCaption(null)
        }}
        onSave={saveCaption}
        open={isEditorOpen}
        pending={pending}
      />

      <AlertDialog
        onOpenChange={(open) => !open && setCaptionToDelete(null)}
        open={Boolean(captionToDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {captionToDelete
                ? t("deleteWarningNamed", { name: captionToDelete.name })
                : t("deleteWarning")}
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
                void deleteCaption()
              }}
              variant="destructive"
            >
              {pending ? (
                <Spinner aria-label={t("deleting")} data-icon="inline-start" />
              ) : null}
              {t("deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function CaptionEditor({
  caption,
  onOpenChange,
  onSave,
  open,
  pending,
}: {
  caption: Caption | null
  onOpenChange: (open: boolean) => void
  onSave: (values: CaptionEditorValues) => Promise<string | null>
  open: boolean
  pending: boolean
}) {
  const t = useTranslations("captions")
  const [values, setValues] = useState<CaptionEditorValues>(() =>
    caption ? toEditorValues(caption) : emptyEditorValues
  )
  const formComplete = Boolean(values.name.trim() && values.content.trim())

  function updateValue<Key extends keyof CaptionEditorValues>(
    key: Key,
    value: CaptionEditorValues[Key]
  ) {
    setValues((currentValues) => ({ ...currentValues, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formComplete) {
      toast.error(t("missingFields"))
      return
    }
    const saveError = await onSave(values)
    if (saveError) toast.error(saveError)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-lg lg:max-w-xl"
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{caption ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>
            {caption ? t("editDescription") : t("createDescription")}
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="caption-name">
                  {t("name")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="caption-name"
                  maxLength={120}
                  onChange={(event) => updateValue("name", event.target.value)}
                  placeholder={t("namePlaceholder")}
                  value={values.name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="caption-tags">{t("tags")}</FieldLabel>
                <Input
                  id="caption-tags"
                  maxLength={1299}
                  onChange={(event) => updateValue("tags", event.target.value)}
                  placeholder={t("tagsPlaceholder")}
                  value={values.tags}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="caption-source">
                  {t("source")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Select
                  onValueChange={(value: CaptionSourceType) =>
                    updateValue("sourceType", value)
                  }
                  value={values.sourceType}
                >
                  <SelectTrigger
                    aria-required="true"
                    className="w-full"
                    id="caption-source"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="manual">
                        {t("sourceLabel.manual")}
                      </SelectItem>
                      <SelectItem value="ai">{t("sourceLabel.ai")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="caption-status">
                  {t("status")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Select
                  onValueChange={(value: CaptionStatus) =>
                    updateValue("status", value)
                  }
                  value={values.status}
                >
                  <SelectTrigger
                    aria-required="true"
                    className="w-full"
                    id="caption-status"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">
                        {t("statusLabel.active")}
                      </SelectItem>
                      <SelectItem value="draft">
                        {t("statusLabel.draft")}
                      </SelectItem>
                      <SelectItem value="archived">
                        {t("statusLabel.archived")}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="caption-content">
                  {t("content")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Textarea
                  aria-required="true"
                  id="caption-content"
                  maxLength={10000}
                  onChange={(event) =>
                    updateValue("content", event.target.value)
                  }
                  placeholder={t("contentPlaceholder")}
                  rows={5}
                  value={values.content}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="caption-notes">{t("notes")}</FieldLabel>
                <Textarea
                  id="caption-notes"
                  maxLength={2000}
                  onChange={(event) => updateValue("notes", event.target.value)}
                  placeholder={t("notesPlaceholder")}
                  rows={3}
                  value={values.notes}
                />
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
            <Button disabled={pending || !formComplete} type="submit">
              {pending ? (
                <Spinner aria-label={t("saving")} data-icon="inline-start" />
              ) : (
                <Save aria-hidden="true" data-icon="inline-start" />
              )}
              {caption ? t("saveChanges") : t("save")}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}
