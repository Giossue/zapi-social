"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import {
  Check,
  CircleAlert,
  EllipsisVertical,
  Eye,
  FileSearch,
  Pencil,
  ShieldX,
  Trash2,
} from "lucide-react"
import { toast } from "@workspace/ui/components/toast"

import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { TablePagination } from "@workspace/ui/components/table-pagination"
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
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { Textarea } from "@workspace/ui/components/textarea"

import {
  type AdminCollectionDefinition,
  type AdminMockField,
  type AdminMockRow,
  type AdminMockTone,
  type AdminSecondaryModuleKey,
  adminSecondaryDefinitions,
} from "../fixtures/admin-secondary"

const PAGE_SIZE = 6

type FieldValues = Record<string, string | boolean | readonly string[]>
export type AdminSecondaryViewState =
  "normal" | "loading" | "empty" | "error" | "forbidden"

/**
 * Las claves llegan del catálogo de mockups, así que el tipado de `next-intl`
 * no puede comprobarlas: se pide el traductor con una firma llana.
 */
type Translate = (key: string, values?: Record<string, string>) => string

function useMockTranslate(): Translate {
  return useTranslations("adminMockups") as unknown as Translate
}

function initialValues(fields: readonly AdminMockField[]): FieldValues {
  return Object.fromEntries(fields.map((field) => [field.name, field.value]))
}

function valuesFromRow(
  fields: readonly AdminMockField[],
  row: AdminMockRow
): FieldValues {
  const values = initialValues(fields)
  const hasSlugLikeField = fields.some(
    (field) => field.name === "slug" || field.name === "locale"
  )
  for (const field of fields) {
    if (field.name === "status") values[field.name] = row.statusKey
    else if (field.name === "slug" || field.name === "locale") {
      values[field.name] = row.values[0]?.secondary ?? ""
    } else if (field.name === "description" && !hasSlugLikeField) {
      values[field.name] = row.values[0]?.secondary ?? ""
    } else if (["category", "area"].includes(field.name)) {
      values[field.name] = row.values[1]?.primary ?? field.value
    } else if (
      ["name", "title", "question", "label", "scope", "task"].includes(
        field.name
      )
    ) {
      values[field.name] = row.values[0]?.primary ?? field.value
    }
  }
  return values
}

function rowWithValues(
  definition: AdminCollectionDefinition,
  values: FieldValues,
  current?: AdminMockRow
): AdminMockRow {
  const cells: Array<{
    mono?: boolean
    primary: string
    secondary?: string
  }> = current
    ? current.values.map((cell) => ({ ...cell }))
    : definition.columnKeys.map(() => ({ primary: "—" }))
  const primaryField = definition.action?.fields.find((field) =>
    ["name", "title", "question", "label", "scope", "task"].includes(field.name)
  )
  const secondaryField =
    definition.action?.fields.find((field) =>
      ["slug", "locale"].includes(field.name)
    ) ?? definition.action?.fields.find((field) => field.name === "description")
  const secondColumnField = definition.action?.fields.find((field) =>
    ["category", "area"].includes(field.name)
  )
  const statusField = definition.action?.fields.find(
    (field) => field.name === "status"
  )

  if (cells[0] && primaryField) {
    cells[0].primary = String(values[primaryField.name] ?? "—")
  }
  if (cells[0] && secondaryField) {
    cells[0].secondary = String(values[secondaryField.name] ?? "")
  }
  if (cells[1] && secondColumnField) {
    cells[1].primary = String(values[secondColumnField.name] ?? "—")
  }

  const statusKey = statusField
    ? String(values[statusField.name] ?? current?.statusKey ?? "active")
    : (current?.statusKey ?? definition.statusKeys[0] ?? "active")
  const tone = current?.tone ?? toneForStatus(statusKey)

  return {
    id: current?.id ?? `mock-${Date.now()}`,
    search: cells.flatMap((cell) => [cell.primary, cell.secondary]).join(" "),
    statusKey,
    tone,
    values: cells,
  }
}

/** Trabaja sobre la clave, no sobre el rótulo: no depende del idioma activo. */
function toneForStatus(statusKey: string): AdminMockTone {
  const normalized = statusKey.toLowerCase()
  if (normalized.includes("error")) return "destructive"
  if (
    normalized.includes("unused") ||
    normalized.includes("unverified") ||
    normalized.includes("without") ||
    normalized.includes("disabled") ||
    normalized.includes("draft")
  ) {
    return "neutral"
  }
  if (normalized.includes("atención") || normalized.includes("incompleto")) {
    return "warning"
  }
  if (normalized.includes("programado") || normalized.includes("ejecución")) {
    return "info"
  }
  if (
    normalized.includes("activ") ||
    normalized.includes("publicad") ||
    normalized.includes("visible") ||
    normalized.includes("correct") ||
    normalized.includes("saludable") ||
    normalized.includes("disponible")
  ) {
    return "success"
  }
  return "neutral"
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function StatusBadge({ label, tone }: { label: string; tone: AdminMockTone }) {
  return <Badge variant={tone}>{label}</Badge>
}

/**
 * Escalona las columnas dinámicas: la primera queda siempre visible junto a
 * Estado y Acciones; las dos siguientes aparecen desde md y el resto desde lg.
 */
function responsiveColumnClass(index: number) {
  if (index === 0) return undefined
  return index <= 2 ? "hidden md:table-cell" : "hidden lg:table-cell"
}

function MetricGrid({
  metrics,
}: {
  metrics?: AdminCollectionDefinition["metrics"]
}) {
  const t = useMockTranslate()
  if (!metrics?.length) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard
          description={t(`metric.${metric.key}.description`)}
          icon={metric.icon}
          key={metric.key}
          label={t(`metric.${metric.key}.label`)}
          value={metric.value}
        />
      ))}
    </div>
  )
}

function MockField({
  field,
  onChange,
  value,
}: {
  field: AdminMockField
  onChange: (value: string | boolean | readonly string[]) => void
  value: string | boolean | readonly string[]
}) {
  const t = useMockTranslate()
  if (field.kind === "permissions") {
    const selected = Array.isArray(value) ? (value as readonly string[]) : []
    return (
      <FieldSet>
        <FieldLegend>{t(field.labelKey)}</FieldLegend>
        {field.hasDescription ? (
          <FieldDescription>{t(`${field.labelKey}Hint`)}</FieldDescription>
        ) : null}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("moduleColumn")}</TableHead>
                {field.permissionActions?.map((action) => (
                  <TableHead className="text-center" key={action.key}>
                    {t(`permissionAction.${action.key}`)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {field.permissionGroups?.map((group) => (
                <TableRow key={group.key}>
                  <TableCell className="font-medium">
                    {t(`permissionGroup.${group.key}`)}
                  </TableCell>
                  {field.permissionActions?.map((action) => {
                    const permissionKey = `${group.key}.${action.key}`
                    return (
                      <TableCell className="text-center" key={permissionKey}>
                        <Checkbox
                          aria-label={`${t(
                            `permissionGroup.${group.key}`
                          )}: ${t(`permissionAction.${action.key}`)}`}
                          checked={selected.includes(permissionKey)}
                          onCheckedChange={(checked) =>
                            onChange(
                              checked === true
                                ? [...selected, permissionKey]
                                : selected.filter(
                                    (item) => item !== permissionKey
                                  )
                            )
                          }
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </FieldSet>
    )
  }

  if (field.kind === "switch") {
    return (
      <Field orientation="horizontal">
        <div className="flex flex-1 flex-col gap-0.5">
          <FieldLabel htmlFor={field.name}>{t(field.labelKey)}</FieldLabel>
          {field.hasDescription ? (
            <FieldDescription>{t(`${field.labelKey}Hint`)}</FieldDescription>
          ) : null}
        </div>
        <Switch
          checked={Boolean(value)}
          id={field.name}
          onCheckedChange={onChange}
        />
      </Field>
    )
  }

  const requiredProps = field.required
    ? { "aria-required": true as const }
    : undefined
  let control = (
    <Input
      {...requiredProps}
      aria-readonly={field.kind === "display" || undefined}
      id={field.name}
      onChange={(event) => onChange(event.target.value)}
      placeholder={
        field.hasPlaceholder ? t(`${field.labelKey}Placeholder`) : undefined
      }
      readOnly={field.kind === "display"}
      value={String(value)}
    />
  )

  if (field.kind === "select") {
    control = (
      <Select onValueChange={onChange} value={String(value)}>
        <SelectTrigger
          {...requiredProps}
          aria-label={t(field.labelKey)}
          className="w-full"
          id={field.name}
        >
          <SelectValue
            placeholder={
              field.hasPlaceholder
                ? t(`${field.labelKey}Placeholder`)
                : undefined
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }

  if (field.kind === "textarea") {
    control = (
      <Textarea
        {...requiredProps}
        id={field.name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          field.hasPlaceholder ? t(`${field.labelKey}Placeholder`) : undefined
        }
        value={String(value)}
      />
    )
  }

  return (
    <Field>
      <FieldLabel htmlFor={field.name}>
        {t(field.labelKey)} {field.required ? <RequiredMark /> : null}
      </FieldLabel>
      {control}
      {field.hasDescription ? (
        <FieldDescription>{t(`${field.labelKey}Hint`)}</FieldDescription>
      ) : null}
    </Field>
  )
}

function CollectionMockup({
  definition,
  forceEmpty,
  moduleKey,
}: {
  definition: AdminCollectionDefinition
  forceEmpty: boolean
  moduleKey: AdminSecondaryModuleKey
}) {
  const t = useMockTranslate()
  const locale = useLocale()
  const [records, setRecords] = React.useState<AdminMockRow[]>(() => [
    ...definition.rows,
  ])
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [pageIndex, setPageIndex] = React.useState(0)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingRow, setEditingRow] = React.useState<AdminMockRow | null>(null)
  const [detailRow, setDetailRow] = React.useState<AdminMockRow | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<AdminMockRow | null>(
    null
  )
  const [saving, setSaving] = React.useState(false)
  const [values, setValues] = React.useState<FieldValues>(() =>
    initialValues(definition.action?.fields ?? [])
  )
  const [baselineValues, setBaselineValues] = React.useState<FieldValues>(() =>
    initialValues(definition.action?.fields ?? [])
  )

  const filteredRows = React.useMemo(() => {
    if (forceEmpty) return []
    const needle = search.trim().toLocaleLowerCase(locale)
    return records.filter((row) => {
      const matchesSearch =
        !needle || row.search.toLocaleLowerCase(locale).includes(needle)
      const matchesStatus = status === "all" || row.statusKey === status
      return matchesSearch && matchesStatus
    })
  }, [forceEmpty, locale, records, search, status])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const rows = filteredRows.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  )
  const fields = definition.action?.fields ?? []
  const complete = fields.every(
    (field) =>
      !field.required || String(values[field.name] ?? "").trim().length > 0
  )
  const dirty = JSON.stringify(values) !== JSON.stringify(baselineValues)
  const actionMode = definition.action?.mode
  const showsCreateAction = definition.action ? actionMode !== "edit" : false
  const supportsEdit = actionMode === "create" || actionMode === "edit"
  const supportsDelete = actionMode === "create"
  const hasFilters = Boolean(search || status !== "all")

  function openSheet(row?: AdminMockRow) {
    setEditingRow(row ?? null)
    const nextValues = row ? valuesFromRow(fields, row) : initialValues(fields)
    setValues(nextValues)
    setBaselineValues(nextValues)
    setSheetOpen(true)
  }

  function submitForm() {
    if (!definition.action || !complete) {
      toast.error(t("missingFields"))
      return
    }
    if (editingRow && !dirty) return
    setSaving(true)
    window.setTimeout(() => {
      if (definition.action?.mode === "execute") {
        setSaving(false)
        setSheetOpen(false)
        toast.success(t(`action.${moduleKey}.executed`))
        return
      }
      const updated = rowWithValues(definition, values, editingRow ?? undefined)
      setRecords((current) =>
        editingRow
          ? current.map((row) => (row.id === editingRow.id ? updated : row))
          : [updated, ...current]
      )
      setSearch("")
      setStatus("all")
      setPageIndex(0)
      setSaving(false)
      setSheetOpen(false)
      toast.success(t(`action.${moduleKey}.saved`))
    }, 250)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setSaving(true)
    window.setTimeout(() => {
      setRecords((current) => current.filter((row) => row.id !== id))
      setPendingDelete(null)
      setSaving(false)
      toast.success(t("recordDeleted"))
    }, 250)
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

      <MetricGrid metrics={definition.metrics} />

      <Card variant="subtle">
        <DataTableHeader
          action={
            definition.action && showsCreateAction ? (
              <Button
                className="hidden sm:inline-flex"
                onClick={() => openSheet()}
                size="sm"
              >
                <definition.action.icon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                {t(`action.${moduleKey}.label`)}
              </Button>
            ) : undefined
          }
          search={{
            ariaLabel: t("searchAria", {
              section: t(`module.${moduleKey}.title`),
            }),
            onChange: (value) => {
              setSearch(value)
              setPageIndex(0)
            },
            placeholder: t(`module.${moduleKey}.searchPlaceholder`),
            value: search,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <DataTableToolbar>
            <DataTableFilter
              ariaLabel={t("filterStatus")}
              label={t("statusColumn")}
              onValueChange={(value) => {
                setStatus(value)
                setPageIndex(0)
              }}
              options={[
                { label: t("allStatuses"), value: "all" },
                ...definition.statusKeys.map((key) => ({
                  label: t(`status.${key}`),
                  value: key,
                })),
              ]}
              value={status}
            />
          </DataTableToolbar>

          <Table>
            <TableHeader>
              <TableRow>
                {definition.columnKeys.map((column, index) => (
                  <TableHead
                    className={responsiveColumnClass(index)}
                    key={column}
                  >
                    {t(`column.${column}`)}
                  </TableHead>
                ))}
                <TableHead>{t("statusColumn")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {row.values.map((cell, index) => (
                    <TableCell
                      className={responsiveColumnClass(index)}
                      key={`${row.id}-${definition.columnKeys[index] ?? index}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={
                            cell.mono ? "font-mono text-xs" : "font-medium"
                          }
                        >
                          {cell.primary}
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
                            row: row.values[0]?.primary ?? row.id,
                          })}
                          size="icon-sm"
                          variant="brand-secondary"
                        >
                          <EllipsisVertical aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onSelect={() => setDetailRow(row)}>
                            <Eye aria-hidden="true" /> Ver
                          </DropdownMenuItem>
                          {supportsEdit ? (
                            <DropdownMenuItem onSelect={() => openSheet(row)}>
                              <Pencil aria-hidden="true" /> Editar
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuGroup>
                        {supportsDelete ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setPendingDelete(row)}
                              >
                                <Trash2 aria-hidden="true" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={definition.columnKeys.length + 2}>
                    <Empty className="min-h-48">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <FileSearch aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>
                          {hasFilters ? t("noResults") : t("emptyTitle")}
                        </EmptyTitle>
                        <EmptyDescription>
                          {hasFilters
                            ? t("noResultsDescription")
                            : t("emptyDescription")}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <TablePagination
            canGoNext={currentPage < pageCount - 1}
            canGoPrevious={currentPage > 0}
            itemLabel={t("itemLabel")}
            onNextPage={() =>
              setPageIndex((current) => Math.min(current + 1, pageCount - 1))
            }
            onPreviousPage={() =>
              setPageIndex((current) => Math.max(current - 1, 0))
            }
            rangeEnd={Math.min(
              (currentPage + 1) * PAGE_SIZE,
              filteredRows.length
            )}
            rangeStart={filteredRows.length ? currentPage * PAGE_SIZE + 1 : 0}
            total={filteredRows.length}
          />
        </CardContent>
      </Card>

      {definition.action && showsCreateAction ? (
        <FloatingActionButton
          icon={
            <definition.action.icon aria-hidden="true" className="size-6" />
          }
          label={t(`action.${moduleKey}.label`)}
          onClick={() => openSheet()}
        />
      ) : null}

      {definition.action ? (
        <Sheet onOpenChange={setSheetOpen} open={sheetOpen}>
          <SheetContent className="w-full gap-0 sm:max-w-xl">
            <SheetHeader className="border-b pr-12">
              <SheetTitle>
                {editingRow && actionMode === "create"
                  ? t(`action.${moduleKey}.editTitle`)
                  : t(`action.${moduleKey}.label`)}
              </SheetTitle>
              <SheetDescription>
                {t(`action.${moduleKey}.description`)}
              </SheetDescription>
            </SheetHeader>
            <form
              className="flex min-h-0 flex-1 flex-col"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                submitForm()
              }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <FieldGroup>
                  {fields.map((field) => (
                    <MockField
                      field={field}
                      key={field.name}
                      onChange={(value) =>
                        setValues((current) => ({
                          ...current,
                          [field.name]: value,
                        }))
                      }
                      value={values[field.name] ?? ""}
                    />
                  ))}
                </FieldGroup>
              </div>
              <SheetFooter className="flex-row justify-end border-t">
                <Button
                  disabled={saving}
                  onClick={() => setSheetOpen(false)}
                  type="button"
                  variant="brand-secondary"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={
                    !complete || saving || (editingRow !== null && !dirty)
                  }
                  type="submit"
                >
                  {saving ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Check aria-hidden="true" data-icon="inline-start" />
                  )}
                  {editingRow
                    ? t("saveChanges")
                    : t(`action.${moduleKey}.label`)}
                </Button>
              </SheetFooter>
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
              {detailRow?.values[0]?.primary ?? t("detail")}
            </SheetTitle>
            <SheetDescription>{t("detailDescription")}</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {detailRow?.values.map((cell, index) => (
              <div
                className="flex flex-col gap-0.5"
                key={definition.columnKeys[index] ?? cell.primary}
              >
                <span className="text-xs text-muted-foreground">
                  {definition.columnKeys[index]
                    ? t(`column.${definition.columnKeys[index]}`)
                    : t("fieldNumber", { index: String(index + 1) })}
                </span>
                <span className={cell.mono ? "font-mono text-sm" : "text-sm"}>
                  {cell.primary}
                </span>
                {cell.secondary ? (
                  <span className="text-xs text-muted-foreground">
                    {cell.secondary}
                  </span>
                ) : null}
              </div>
            ))}
            {detailRow ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  {t("statusColumn")}
                </span>
                <StatusBadge
                  label={t(`status.${detailRow.statusKey}`)}
                  tone={detailRow.tone}
                />
              </div>
            ) : null}
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              onClick={() => setDetailRow(null)}
              variant="brand-secondary"
            >
              Cerrar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        onOpenChange={(open) => !open && setPendingDelete(null)}
        open={pendingDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? t("deleteDescription", {
                    name: pendingDelete.values[0]?.primary ?? t("thisRecord"),
                  })
                : t("deleteFallback")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="brand-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={confirmDelete}
              variant="destructive"
            >
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 aria-hidden="true" data-icon="inline-start" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function AdminSecondaryModuleMockup({
  moduleKey,
  viewState = "normal",
}: {
  moduleKey: AdminSecondaryModuleKey
  viewState?: AdminSecondaryViewState
}) {
  const t = useMockTranslate()
  const definition = adminSecondaryDefinitions[moduleKey]

  if (viewState === "loading") {
    return <PageLoading className="min-h-80" />
  }

  if (viewState === "error") {
    return (
      <Card variant="subtle">
        <EmptyState
          description={t("loadFailed")}
          icon={CircleAlert}
          title={t("loadFailedTitle")}
        />
      </Card>
    )
  }

  if (viewState === "forbidden") {
    return (
      <Card variant="subtle">
        <EmptyState
          description={t("forbiddenDescription")}
          icon={ShieldX}
          title={t("forbiddenTitle")}
        />
      </Card>
    )
  }

  return (
    <CollectionMockup
      definition={definition}
      forceEmpty={viewState === "empty"}
      moduleKey={moduleKey}
    />
  )
}
