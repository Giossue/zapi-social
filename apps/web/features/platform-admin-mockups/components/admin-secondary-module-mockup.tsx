"use client"

import { useMemo, useState } from "react"

import {
  Check,
  CircleAlert,
  Copy,
  EllipsisVertical,
  Eye,
  FileSearch,
  Pencil,
  Save,
  ShieldX,
  Trash2,
} from "lucide-react"
import { toast } from "@workspace/ui/components/toast"
import { CardGrid } from "@workspace/ui/components/card-grid"

import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { PageLoading } from "@workspace/ui/components/page-loading"
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
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  type AdminCollectionDefinition,
  type AdminMockField,
  type AdminMockRow,
  type AdminMockTone,
  type AdminSecondaryModuleKey,
  type AdminSettingsDefinition,
  adminSecondaryDefinitions,
} from "../fixtures/admin-secondary-fixtures"

const PAGE_SIZE = 10

type FieldValues = Record<string, string | boolean>
export type AdminSecondaryViewState =
  "normal" | "loading" | "empty" | "error" | "forbidden"

function initialValues(fields: readonly AdminMockField[]): FieldValues {
  return Object.fromEntries(fields.map((field) => [field.name, field.value]))
}

function valuesFromRow(
  fields: readonly AdminMockField[],
  row: AdminMockRow
): FieldValues {
  const values = initialValues(fields)
  for (const field of fields) {
    if (field.name === "status") values[field.name] = row.status
    else if (field.name === "slug" || field.name === "locale") {
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
    : definition.columns.map(() => ({ primary: "—" }))
  const primaryField = definition.action?.fields.find((field) =>
    ["name", "title", "question", "label", "scope", "task"].includes(field.name)
  )
  const secondaryField = definition.action?.fields.find((field) =>
    ["slug", "locale"].includes(field.name)
  )
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

  const status = statusField
    ? String(values[statusField.name] ?? current?.status ?? "Activo")
    : (current?.status ?? definition.filterOptions[1]?.value ?? "Activo")
  const tone = current?.tone ?? toneForStatus(status)

  return {
    id: current?.id ?? `mock-${Date.now()}`,
    search: cells.flatMap((cell) => [cell.primary, cell.secondary]).join(" "),
    status,
    tone,
    values: cells,
  }
}

function toneForStatus(status: string): AdminMockTone {
  const normalized = status.toLocaleLowerCase("es")
  if (normalized.includes("error")) return "destructive"
  if (
    normalized.includes("inactiv") ||
    normalized.includes("deshabil") ||
    normalized.includes("ocult") ||
    normalized.includes("borrador") ||
    normalized.includes("archivad")
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

function MetricGrid({
  metrics,
}: {
  metrics?: AdminCollectionDefinition["metrics"]
}) {
  if (!metrics?.length) return null

  return (
    <CardGrid>
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </CardGrid>
  )
}

function MockField({
  field,
  onChange,
  value,
}: {
  field: AdminMockField
  onChange: (value: string | boolean) => void
  value: string | boolean
}) {
  if (field.kind === "switch") {
    return (
      <Field orientation="horizontal">
        <div className="flex flex-1 flex-col gap-0.5">
          <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
          {field.description ? (
            <FieldDescription>{field.description}</FieldDescription>
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
      placeholder={field.placeholder}
      readOnly={field.kind === "display"}
      value={String(value)}
    />
  )

  if (field.kind === "select") {
    control = (
      <Select onValueChange={onChange} value={String(value)}>
        <SelectTrigger
          {...requiredProps}
          aria-label={field.label}
          className="w-full"
          id={field.name}
        >
          <SelectValue placeholder={field.placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
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
        placeholder={field.placeholder}
        value={String(value)}
      />
    )
  }

  return (
    <Field>
      <FieldLabel htmlFor={field.name}>
        {field.label} {field.required ? <RequiredMark /> : null}
      </FieldLabel>
      {control}
      {field.description ? (
        <FieldDescription>{field.description}</FieldDescription>
      ) : null}
    </Field>
  )
}

function CollectionMockup({
  definition,
  forceEmpty,
}: {
  definition: AdminCollectionDefinition
  forceEmpty: boolean
}) {
  const [records, setRecords] = useState<AdminMockRow[]>(() => [
    ...definition.rows,
  ])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [pageIndex, setPageIndex] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<AdminMockRow | null>(null)
  const [detailRow, setDetailRow] = useState<AdminMockRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AdminMockRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<FieldValues>(() =>
    initialValues(definition.action?.fields ?? [])
  )
  const [baselineValues, setBaselineValues] = useState<FieldValues>(() =>
    initialValues(definition.action?.fields ?? [])
  )

  const filteredRows = useMemo(() => {
    if (forceEmpty) return []
    const needle = search.trim().toLocaleLowerCase("es")
    return records.filter((row) => {
      const matchesSearch =
        !needle || row.search.toLocaleLowerCase("es").includes(needle)
      const matchesStatus = status === "all" || row.status === status
      return matchesSearch && matchesStatus
    })
  }, [forceEmpty, records, search, status])

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
  const supportsCrud = definition.action?.mode === "create"
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
      toast.error("Completa todos los campos obligatorios.")
      return
    }
    if (editingRow && !dirty) return
    setSaving(true)
    window.setTimeout(() => {
      if (definition.action?.mode === "execute") {
        setSaving(false)
        setSheetOpen(false)
        toast.success(definition.action.successMessage)
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
      toast.success(definition.action?.successMessage ?? "Cambios guardados.")
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
      toast.success("Elemento eliminado.")
    }, 250)
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {definition.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {definition.description}
        </p>
      </header>

      <MetricGrid metrics={definition.metrics} />

      <Card variant="subtle">
        <DataTableHeader
          action={
            definition.action ? (
              <Button
                className="hidden sm:inline-flex"
                onClick={() => openSheet()}
                size="sm"
              >
                <definition.action.icon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                {definition.action.label}
              </Button>
            ) : undefined
          }
          search={{
            ariaLabel: `Buscar en ${definition.title}`,
            onChange: (value) => {
              setSearch(value)
              setPageIndex(0)
            },
            placeholder: `Buscar en ${definition.title.toLocaleLowerCase("es")}...`,
            value: search,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <DataTableToolbar>
            <DataTableFilter
              ariaLabel="Filtrar por estado"
              label="Estado"
              onValueChange={(value) => {
                setStatus(value)
                setPageIndex(0)
              }}
              options={definition.filterOptions}
              value={status}
            />
          </DataTableToolbar>

          <Table>
            <TableHeader>
              <TableRow>
                {definition.columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {row.values.map((cell, index) => (
                    <TableCell
                      key={`${row.id}-${definition.columns[index] ?? index}`}
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
                    <StatusBadge label={row.status} tone={row.tone} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label={`Acciones para ${row.values[0]?.primary ?? row.id}`}
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
                          {supportsCrud ? (
                            <DropdownMenuItem onSelect={() => openSheet(row)}>
                              <Pencil aria-hidden="true" /> Editar
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuGroup>
                        {supportsCrud ? (
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
                  <TableCell colSpan={definition.columns.length + 2}>
                    <Empty className="min-h-48">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <FileSearch aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>
                          {hasFilters
                            ? "Sin resultados"
                            : "Aún no hay registros"}
                        </EmptyTitle>
                        <EmptyDescription>
                          {hasFilters
                            ? "Ajusta la búsqueda o el filtro de estado."
                            : "Los nuevos registros aparecerán en esta tabla."}
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
            itemLabel={definition.title.toLowerCase()}
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

      {definition.action ? (
        <FloatingActionButton
          icon={
            <definition.action.icon aria-hidden="true" className="size-6" />
          }
          label={definition.action.label}
          onClick={() => openSheet()}
        />
      ) : null}

      {definition.action ? (
        <Sheet onOpenChange={setSheetOpen} open={sheetOpen}>
          <SheetContent className="w-full gap-0 sm:max-w-xl">
            <SheetHeader className="border-b pr-12">
              <SheetTitle>
                {editingRow
                  ? `Editar · ${definition.action.title}`
                  : definition.action.title}
              </SheetTitle>
              <SheetDescription>
                {definition.action.description}
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
              <SheetFooter className="border-t">
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
                  {editingRow ? "Guardar cambios" : definition.action.label}
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
              {detailRow?.values[0]?.primary ?? "Detalle"}
            </SheetTitle>
            <SheetDescription>
              Información registrada en esta sección administrativa.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {detailRow?.values.map((cell, index) => (
              <div
                className="flex flex-col gap-0.5"
                key={definition.columns[index] ?? cell.primary}
              >
                <span className="text-xs text-muted-foreground">
                  {definition.columns[index] ?? `Campo ${index + 1}`}
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
                <span className="text-xs text-muted-foreground">Estado</span>
                <StatusBadge label={detailRow.status} tone={detailRow.tone} />
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
            <AlertDialogTitle>Eliminar registro</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Se eliminará “${pendingDelete.values[0]?.primary ?? "este registro"}” del mockup.`
                : "Confirma la eliminación del registro."}
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

function settingsValues(definition: AdminSettingsDefinition) {
  return Object.fromEntries(
    definition.sections.map((section) => [
      section.key,
      initialValues(section.fields),
    ])
  ) as Record<string, FieldValues>
}

function SettingsMockup({
  definition,
}: {
  definition: AdminSettingsDefinition
}) {
  const [activeSection, setActiveSection] = useState(
    definition.sections[0]?.key ?? ""
  )
  const [valuesBySection, setValuesBySection] = useState(() =>
    settingsValues(definition)
  )
  const [savedBySection, setSavedBySection] = useState(() =>
    settingsValues(definition)
  )
  const [saving, setSaving] = useState(false)
  const section =
    definition.sections.find((item) => item.key === activeSection) ??
    definition.sections[0]

  if (!section) return null

  const activeSectionDefinition = section

  const values =
    valuesBySection[activeSectionDefinition.key] ??
    initialValues(activeSectionDefinition.fields)
  const savedValues =
    savedBySection[activeSectionDefinition.key] ??
    initialValues(activeSectionDefinition.fields)
  const complete = activeSectionDefinition.fields.every(
    (field) =>
      !field.required || String(values[field.name] ?? "").trim().length > 0
  )
  const dirty = JSON.stringify(values) !== JSON.stringify(savedValues)
  const isCopyAction =
    activeSectionDefinition.saveLabel === "Copiar diagnóstico"
  const SubmitIcon = isCopyAction ? Copy : Save

  async function submitSettings() {
    if (!complete) {
      toast.error("Completa todos los campos obligatorios.")
      return
    }
    if (isCopyAction) {
      const diagnostic = activeSectionDefinition.fields
        .map((field) => `${field.label}: ${String(values[field.name] ?? "")}`)
        .join("\n")
      try {
        await navigator.clipboard.writeText(diagnostic)
        toast.success("Diagnóstico copiado.")
      } catch {
        toast.error("No se pudo copiar el diagnóstico.")
      }
      return
    }
    if (!dirty) return
    setSaving(true)
    window.setTimeout(() => {
      setSavedBySection((current) => ({
        ...current,
        [activeSectionDefinition.key]: { ...values },
      }))
      setSaving(false)
      toast.success("Configuración guardada.")
    }, 250)
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {definition.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {definition.description}
        </p>
      </header>

      <MetricGrid metrics={definition.metrics} />

      {definition.sections.length > 1 ? (
        <Tabs onValueChange={setActiveSection} value={activeSection}>
          <TabsList
            aria-label={`Secciones de ${definition.title}`}
            className="flex h-auto flex-wrap"
          >
            {definition.sections.map((item) => (
              <TabsTrigger key={item.key} value={item.key}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submitSettings()
        }}
      >
        <Card variant="subtle">
          <CardHeader className="border-b">
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {section.fields.map((field) => (
                <MockField
                  field={field}
                  key={field.name}
                  onChange={(value) =>
                    setValuesBySection((current) => ({
                      ...current,
                      [section.key]: {
                        ...current[section.key],
                        [field.name]: value,
                      },
                    }))
                  }
                  value={values[field.name] ?? ""}
                />
              ))}
            </FieldGroup>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button
            disabled={!complete || saving || (!isCopyAction && !dirty)}
            type="submit"
          >
            {saving ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SubmitIcon aria-hidden="true" data-icon="inline-start" />
            )}
            {section.saveLabel ?? "Guardar cambios"}
          </Button>
        </div>
      </form>
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
  const definition = adminSecondaryDefinitions[moduleKey]

  if (viewState === "loading") {
    return <PageLoading className="min-h-80" />
  }

  if (viewState === "error") {
    return (
      <Card variant="subtle">
        <EmptyState
          description={`No fue posible cargar ${definition.title.toLocaleLowerCase("es")}.`}
          icon={CircleAlert}
          title="No pudimos cargar esta sección"
        />
      </Card>
    )
  }

  if (viewState === "forbidden") {
    return (
      <Card variant="subtle">
        <EmptyState
          description="Tu cuenta no tiene permisos para administrar esta sección de la plataforma."
          icon={ShieldX}
          title="Acceso restringido"
        />
      </Card>
    )
  }

  if (definition.kind === "collection") {
    return (
      <CollectionMockup
        definition={definition}
        forceEmpty={viewState === "empty"}
      />
    )
  }

  if (viewState === "empty") {
    return (
      <Card variant="subtle">
        <EmptyState
          description="Todavía no existe configuración disponible para esta sección."
          icon={FileSearch}
          title="Sin configuración"
        />
      </Card>
    )
  }

  return <SettingsMockup definition={definition} />
}
