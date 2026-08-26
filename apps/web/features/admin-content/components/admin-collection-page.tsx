"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import {
  CircleAlert,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react"

import { ApiError } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
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
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { Input } from "@workspace/ui/components/input"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { MarkdownEditor } from "@/components/markdown-editor"
import { toast } from "@workspace/ui/components/toast"
import { loginPath } from "@/features/identity/login-redirect"

export type CollectionValues = Record<string, unknown>

export type CollectionField =
  | {
      kind: "text" | "textarea" | "number" | "markdown"
      description?: string
      label: string
      name: string
      placeholder?: string
      required?: boolean
    }
  | {
      kind: "select"
      description?: string
      label: string
      name: string
      options: readonly { label: string; value: string }[]
      required?: boolean
    }
  | {
      kind: "switch"
      description?: string
      label: string
      name: string
    }
  | {
      kind: "checkboxes"
      description?: string
      label: string
      name: string
      options: readonly { label: string; value: string }[]
    }

export type CollectionColumn<TRow> = {
  key: string
  label: string
  hideBelow?: "md" | "lg"
  align?: "right"
  render: (row: TRow) => ReactNode
}

export type CollectionFilter = {
  label: string
  options: readonly { label: string; value: string }[]
}

export type AdminCollectionConfig<TRow, TResponse> = {
  columns: readonly CollectionColumn<TRow>[]
  createLabel: string
  description: string
  emptyDescription: string
  emptyTitle: string
  fields: (response: TResponse | null) => readonly CollectionField[]
  filter?: CollectionFilter
  formDescription: string
  itemLabel: string
  load: (query: {
    q?: string
    status?: string
    page: number
    limit: number
  }) => Promise<TResponse>
  remove: (row: TRow) => Promise<void>
  rowId: (row: TRow) => string
  rowName: (row: TRow) => string
  rows: (response: TResponse) => readonly TRow[]
  save: (id: string | null, values: CollectionValues) => Promise<void>
  searchPlaceholder: string
  title: string
  toValues: (row: TRow | null, response: TResponse | null) => CollectionValues
  total: (response: TResponse) => number
}

const pageSize = 25

function CollectionSheet({
  fields,
  formDescription,
  onOpenChange,
  onSubmit,
  open,
  pending,
  title,
  values: initialValues,
}: {
  fields: readonly CollectionField[]
  formDescription: string
  onOpenChange: (open: boolean) => void
  onSubmit: (values: CollectionValues) => Promise<boolean>
  open: boolean
  pending: boolean
  title: string
  values: CollectionValues
}) {
  const t = useTranslations("adminContent")
  const [values, setValues] = useState<CollectionValues>(initialValues)

  const initialValuesRef = useRef(initialValues)

  useEffect(() => {
    initialValuesRef.current = initialValues
  })

  useEffect(() => {
    if (open) setValues(initialValuesRef.current)
  }, [open])

  function update(name: string, value: unknown) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  const hasMarkdownField = fields.some((field) => field.kind === "markdown")

  const canSubmit = fields
    .filter((field) => "required" in field && field.required)
    .every((field) => String(values[field.name] ?? "").trim().length > 0)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error(t("missingFields"))
      return
    }
    const saved = await onSubmit(values)
    if (saved) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className={cn(
          "w-full gap-0 p-0",
          hasMarkdownField
            ? "sm:max-w-none data-[side=right]:sm:w-full data-[side=right]:sm:border-l-0"
            : "sm:max-w-lg"
        )}
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{formDescription}</SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              {fields.map((field) => {
                const controlId = `collection-${field.name}`
                const required = "required" in field && field.required

                if (field.kind === "switch") {
                  return (
                    <Field key={field.name} orientation="horizontal">
                      <Switch
                        checked={Boolean(values[field.name])}
                        disabled={pending}
                        id={controlId}
                        onCheckedChange={(checked) =>
                          update(field.name, checked)
                        }
                      />
                      <FieldLabel htmlFor={controlId}>
                        <FieldContent>
                          <FieldTitle>{field.label}</FieldTitle>
                          {field.description ? (
                            <FieldDescription>
                              {field.description}
                            </FieldDescription>
                          ) : null}
                        </FieldContent>
                      </FieldLabel>
                    </Field>
                  )
                }

                if (field.kind === "checkboxes") {
                  const selected = Array.isArray(values[field.name])
                    ? (values[field.name] as string[])
                    : []
                  return (
                    <FieldSet key={field.name}>
                      <FieldLabel asChild>
                        <legend>{field.label}</legend>
                      </FieldLabel>
                      {field.options.length ? (
                        <FieldGroup
                          className="gap-3"
                          data-slot="checkbox-group"
                        >
                          {field.options.map((option) => {
                            const optionId = `${controlId}-${option.value}`
                            return (
                              <Field
                                key={option.value}
                                orientation="horizontal"
                              >
                                <Checkbox
                                  checked={selected.includes(option.value)}
                                  disabled={pending}
                                  id={optionId}
                                  onCheckedChange={(checked) =>
                                    update(
                                      field.name,
                                      checked === true
                                        ? [...selected, option.value]
                                        : selected.filter(
                                            (value) => value !== option.value
                                          )
                                    )
                                  }
                                />
                                <FieldLabel htmlFor={optionId}>
                                  <FieldContent>
                                    <FieldTitle>{option.label}</FieldTitle>
                                  </FieldContent>
                                </FieldLabel>
                              </Field>
                            )
                          })}
                        </FieldGroup>
                      ) : (
                        <FieldDescription>{t("noOptions")}</FieldDescription>
                      )}
                    </FieldSet>
                  )
                }

                return (
                  <Field key={field.name}>
                    <FieldLabel htmlFor={controlId}>
                      {field.label}
                      {required ? (
                        <>
                          {" "}
                          <span aria-hidden="true" className="text-destructive">
                            *
                          </span>
                          <span className="sr-only"> {t("required")}</span>
                        </>
                      ) : null}
                    </FieldLabel>
                    {field.kind === "select" ? (
                      <Select
                        disabled={pending}
                        onValueChange={(value) => update(field.name, value)}
                        value={String(values[field.name] ?? "")}
                      >
                        <SelectTrigger
                          aria-required={required ? "true" : undefined}
                          className="w-full"
                          id={controlId}
                        >
                          <SelectValue placeholder={t("selectOption")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {field.options.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    ) : field.kind === "markdown" ? (
                      <MarkdownEditor
                        className="min-h-96"
                        disabled={pending}
                        id={controlId}
                        onChange={(next) => update(field.name, next)}
                        value={String(values[field.name] ?? "")}
                      />
                    ) : field.kind === "textarea" ? (
                      <Textarea
                        aria-required={required ? "true" : undefined}
                        disabled={pending}
                        id={controlId}
                        onChange={(event) =>
                          update(field.name, event.target.value)
                        }
                        placeholder={field.placeholder}
                        rows={5}
                        value={String(values[field.name] ?? "")}
                      />
                    ) : (
                      <Input
                        aria-required={required ? "true" : undefined}
                        disabled={pending}
                        id={controlId}
                        onChange={(event) =>
                          update(field.name, event.target.value)
                        }
                        placeholder={field.placeholder}
                        type={field.kind === "number" ? "number" : "text"}
                        value={String(values[field.name] ?? "")}
                      />
                    )}
                    {field.description ? (
                      <FieldDescription>{field.description}</FieldDescription>
                    ) : null}
                  </Field>
                )
              })}
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
                <Plus data-icon="inline-start" />
              )}
              {t("save")}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AdminCollectionPage<TRow, TResponse>({
  config,
}: {
  config: AdminCollectionConfig<TRow, TResponse>
}) {
  const t = useTranslations("adminContent")
  const router = useRouter()
  const [response, setResponse] = useState<TResponse | null>(null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editing, setEditing] = useState<TRow | null>(null)
  const [toDelete, setToDelete] = useState<TRow | null>(null)

  const configRef = useRef(config)

  useEffect(() => {
    configRef.current = config
  })

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return true
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
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
      const current = configRef.current
      setResponse(
        await current.load({
          limit: pageSize,
          page,
          ...(query.trim() ? { q: query.trim() } : {}),
          ...(current.filter && status !== "all" ? { status } : {}),
        })
      )
      setForbidden(false)
    } catch (error) {
      if (handleError(error)) return
      console.error(`${configRef.current.title} request failed`, error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError, page, query, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  async function save(values: CollectionValues) {
    setPending(true)
    try {
      await config.save(editing ? config.rowId(editing) : null, values)
      await load()
      toast.success(editing ? t("saved") : t("recordCreated"))
      return true
    } catch (error) {
      if (handleError(error)) return false
      console.error(`${config.title} save failed`, error)
      toast.error(t("saveFailed"))
      return false
    } finally {
      setPending(false)
    }
  }

  async function remove(row: TRow) {
    setPending(true)
    try {
      await config.remove(row)
      setToDelete(null)
      await load()
      toast.success(t("recordDeleted"))
    } catch (error) {
      if (handleError(error)) return
      console.error(`${config.title} deletion failed`, error)
      toast.error(t("deleteFailed"))
    } finally {
      setPending(false)
    }
  }

  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description={t("forbiddenDescription")}
            icon={ShieldCheck}
            title={t("unavailable", { section: config.title })}
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !response && !loadError) {
    return (
      <PageLoading aria-label={t("loading", { items: config.itemLabel })} />
    )
  }

  if (loadError || !response) {
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
            description={t("loadFailed", { items: config.itemLabel })}
            icon={CircleAlert}
            title={t("unavailable", { section: config.title })}
          />
        </CardContent>
      </Card>
    )
  }

  const rows = config.rows(response)
  const total = config.total(response)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const rangeStart = total ? (safePage - 1) * pageSize + 1 : 0
  const rangeEnd = total ? rangeStart + rows.length - 1 : 0
  const hasFilters = Boolean(query || status !== "all")

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
          description={config.description}
          title={config.title}
        />
        <Card variant="subtle">
          <DataTableHeader
            action={
              <Button
                className="hidden sm:inline-flex"
                onClick={openCreate}
                size="sm"
                type="button"
              >
                <Plus data-icon="inline-start" /> {config.createLabel}
              </Button>
            }
            search={{
              ariaLabel: t("searchItems", { items: config.itemLabel }),
              onChange: (value) => {
                setQuery(value)
                setPage(1)
              },
              placeholder: config.searchPlaceholder,
              value: query,
            }}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            {config.filter ? (
              <DataTableToolbar
                actions={
                  hasFilters ? (
                    <Button
                      onClick={clearFilters}
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
                  ariaLabel={t("filterBy", { field: config.filter.label })}
                  label={config.filter.label}
                  onValueChange={(value) => {
                    setStatus(value)
                    setPage(1)
                  }}
                  options={config.filter.options}
                  value={status}
                />
              </DataTableToolbar>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  {config.columns.map((column) => (
                    <TableHead
                      className={
                        column.hideBelow === "lg"
                          ? "hidden lg:table-cell"
                          : column.hideBelow === "md"
                            ? "hidden md:table-cell"
                            : undefined
                      }
                      key={column.key}
                    >
                      {column.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? (
                  rows.map((row) => (
                    <TableRow key={config.rowId(row)}>
                      {config.columns.map((column) => (
                        <TableCell
                          className={
                            column.hideBelow === "lg"
                              ? "hidden lg:table-cell"
                              : column.hideBelow === "md"
                                ? "hidden md:table-cell"
                                : undefined
                          }
                          key={column.key}
                        >
                          {column.render(row)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={t("openActions", {
                                name: config.rowName(row),
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
                                setEditing(row)
                                setIsSheetOpen(true)
                              }}
                              size="compact"
                            >
                              <Pencil />
                              {t("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => setToDelete(row)}
                              size="compact"
                              variant="destructive"
                            >
                              <Trash2 />
                              {t("delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    action={
                      hasFilters ? (
                        <Button onClick={clearFilters} variant="outline">
                          {t("resetFilters")}
                        </Button>
                      ) : null
                    }
                    colSpan={config.columns.length + 1}
                    description={
                      hasFilters
                        ? t("emptyFilteredDescription")
                        : config.emptyDescription
                    }
                    title={hasFilters ? t("noMatches") : config.emptyTitle}
                  />
                )}
              </TableBody>
            </Table>
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel={config.itemLabel}
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
        <FloatingActionButton label={config.createLabel} onClick={openCreate} />
      </div>

      <CollectionSheet
        fields={config.fields(response)}
        key={editing ? config.rowId(editing) : "new"}
        formDescription={config.formDescription}
        onOpenChange={setIsSheetOpen}
        onSubmit={save}
        open={isSheetOpen}
        pending={pending}
        title={
          editing
            ? t("editRecord", { name: config.rowName(editing) })
            : config.createLabel
        }
        values={config.toValues(editing, response)}
      />

      <AlertDialog
        onOpenChange={(open) => !open && setToDelete(null)}
        open={Boolean(toDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteTitle", {
                name: toDelete ? config.rowName(toDelete) : "",
              })}
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
                if (toDelete) void remove(toDelete)
              }}
              variant="destructive"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
