"use client"
"use no memo"
import type { ColumnDef } from "@tanstack/react-table"
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
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
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
import { PageLoading } from "@workspace/ui/components/page-loading"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import {
  FileText,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
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

import type {
  Caption,
  CaptionDraft,
  CaptionSourceType,
  CaptionStatus,
} from "@/features/captions/types/captions"

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

const sourceLabels: Record<CaptionSourceType, string> = {
  manual: "Manual",
  ai: "Generado por IA",
}

const statusLabels: Record<CaptionStatus, string> = {
  active: "Activo",
  draft: "Borrador",
  archived: "Archivado",
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

function formatUpdatedAt(value: string) {
  const updatedAt = new Date(value)
  if (Number.isNaN(updatedAt.getTime())) return "Actualizado recientemente"

  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(updatedAt)
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
  if (status === "active") {
    return (
      <Badge
        className="bg-success leading-none text-success-foreground"
        variant="secondary"
      >
        {statusLabels[status]}
      </Badge>
    )
  }

  return (
    <Badge className="leading-none" variant="outline">
      {statusLabels[status]}
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
  return (
    <Badge className="leading-none" variant="outline">
      {sourceLabels[sourceType]}
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
}: CaptionTableActions): ColumnDef<Caption>[] {
  return [
    {
      accessorKey: "name",
      header: "Caption",
      cell: ({ row }) => <CaptionCell caption={row.original} />,
    },
    {
      accessorKey: "sourceType",
      header: "Origen",
      cell: ({ row }) => <SourceCell sourceType={row.original.sourceType} />,
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => <CaptionStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "tags",
      header: "Etiquetas",
      cell: ({ row }) => <TagsCell tags={row.original.tags} />,
    },
    {
      accessorKey: "updatedAt",
      header: "Actualizado",
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {formatUpdatedAt(row.original.updatedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => {
        const caption = row.original

        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={`Abrir acciones para ${caption.name}`}
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
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onRemove(caption)}
                  size="compact"
                  variant="destructive"
                >
                  <Trash2 />
                  Eliminar
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
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const tableData = useMemo(() => [...captions], [captions])
  const table = useReactTable({
    data: tableData,
    columns: createCaptionColumns({ onEdit, onRemove }),
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
        <Table className="**:data-[slot=table-cell]:px-4 **:data-[slot=table-head]:px-4">
          <TableHeader className="[&_tr]:border-t">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="py-4 font-normal">
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
                <TableRow
                  key={row.id}
                  className="border-border/60 hover:bg-white/2.5"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-4 align-middle">
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
        itemLabel="captions"
        mode="compact"
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
        router.replace("/login")
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
          router.replace("/login")
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

    if (!name || !content) return "Nombre y contenido son obligatorios."
    if (tags.length > 20 || tags.some((tag) => tag.length > 64)) {
      return "Usa hasta 20 etiquetas de 64 caracteres como máximo."
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
        toast.success("Cambios guardados.")
      } else {
        const newCaption = await captionsApi.create(draft)
        setCaptions((currentCaptions) => [newCaption, ...currentCaptions])
        toast.success("Caption creado.")
      }

      setIsEditorOpen(false)
      setEditingCaption(null)
      return null
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace("/login")
        return null
      }

      console.error("Caption save failed", error)
      toast.error("No se pudo guardar el caption.")
      return "No pudimos guardar los cambios. Revisa los datos e inténtalo de nuevo."
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
      toast.success("Caption eliminado.")
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace("/login")
        return
      }

      console.error("Caption delete failed", error)
      toast.error("No se pudo eliminar el caption.")
    } finally {
      setPending(false)
    }
  }

  if (isLoading) return <CaptionsLoading />

  if (!hasPermission) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            description="Pide acceso a un administrador del espacio de trabajo."
            icon={LockKeyhole}
            title="No tienes acceso a los captions"
          />
        </CardContent>
      </Card>
    )
  }

  if (hasLoadError) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            action={
              <Button onClick={() => void loadCaptions()}>Reintentar</Button>
            }
            description="No pudimos cargar la biblioteca en este momento. Inténtalo de nuevo."
            icon={TriangleAlert}
            title="No pudimos cargar los captions"
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
          Limpiar filtros
        </Button>
      }
      description="Prueba con otro término de búsqueda."
      icon={Search}
      title="No encontramos captions"
    />
  ) : (
    <EmptyState
      description="Crea un caption para empezar a construir tu biblioteca."
      icon={FileText}
      title="Aún no hay captions"
    />
  )

  return (
    <>
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">
            Biblioteca de captions
          </CardTitle>
          <CardDescription className="max-w-sm leading-snug">
            Gestiona textos reutilizables para mantener una voz consistente en
            tus publicaciones.
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-64">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Buscar captions"
                className="h-7"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar captions..."
                value={searchQuery}
              />
            </InputGroup>
            <Button onClick={openCreateEditor} size="sm" type="button">
              <Plus />
              Nuevo caption
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                onValueChange={(value: CaptionSourceType | "all") =>
                  setSourceFilter(value)
                }
                value={sourceFilter}
              >
                <SelectTrigger size="sm">
                  <span className="text-muted-foreground">Origen:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectGroup>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="ai">Generado por IA</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                onValueChange={(value: CaptionStatus | "all") =>
                  setStatusFilter(value)
                }
                value={statusFilter}
              >
                <SelectTrigger size="sm">
                  <span className="text-muted-foreground">Estado:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectGroup>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {hasActiveFilters ? (
                <Button
                  onClick={clearFilters}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <X />
                  Limpiar
                </Button>
              ) : null}
            </div>
          </div>
          <CaptionsTable
            captions={filteredCaptions}
            emptyState={emptyState}
            onEdit={openEditEditor}
            onRemove={setCaptionToDelete}
          />
        </CardContent>
      </Card>

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
            <AlertDialogTitle>¿Eliminar este caption?</AlertDialogTitle>
            <AlertDialogDescription>
              {captionToDelete
                ? `“${captionToDelete.name}” se eliminará de la biblioteca. Esta acción no se puede deshacer.`
                : "Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                void deleteCaption()
              }}
              variant="destructive"
            >
              {pending ? (
                <RefreshCw className="animate-spin" data-icon="inline-start" />
              ) : null}
              Eliminar caption
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
  const [values, setValues] = useState<CaptionEditorValues>(() =>
    caption ? toEditorValues(caption) : emptyEditorValues
  )
  const [saveError, setSaveError] = useState<string | null>(null)

  function updateValue<Key extends keyof CaptionEditorValues>(
    key: Key,
    value: CaptionEditorValues[Key]
  ) {
    setValues((currentValues) => ({ ...currentValues, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError(null)
    setSaveError(await onSave(values))
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-lg lg:max-w-xl"
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>
            {caption ? "Editar caption" : "Nuevo caption"}
          </SheetTitle>
          <SheetDescription>
            {caption
              ? "Actualiza el contenido y los metadatos que tu equipo necesita para reutilizarlo."
              : "Guarda un caption que puedas encontrar y adaptar en futuras publicaciones."}
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="caption-name">Nombre</FieldLabel>
                <Input
                  id="caption-name"
                  maxLength={120}
                  onChange={(event) => updateValue("name", event.target.value)}
                  placeholder="Ej. Lanzamiento de colección"
                  required
                  value={values.name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="caption-tags">Etiquetas</FieldLabel>
                <Input
                  id="caption-tags"
                  maxLength={1299}
                  onChange={(event) => updateValue("tags", event.target.value)}
                  placeholder="lanzamiento, producto"
                  value={values.tags}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="caption-source">Origen</FieldLabel>
                <Select
                  onValueChange={(value: CaptionSourceType) =>
                    updateValue("sourceType", value)
                  }
                  value={values.sourceType}
                >
                  <SelectTrigger id="caption-source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="ai">Generado por IA</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="caption-status">Estado</FieldLabel>
                <Select
                  onValueChange={(value: CaptionStatus) =>
                    updateValue("status", value)
                  }
                  value={values.status}
                >
                  <SelectTrigger id="caption-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="archived">Archivado</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="caption-content">Contenido</FieldLabel>
                <Textarea
                  id="caption-content"
                  maxLength={10000}
                  onChange={(event) =>
                    updateValue("content", event.target.value)
                  }
                  placeholder="Escribe el caption que quieres guardar"
                  required
                  rows={5}
                  value={values.content}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="caption-notes">Notas internas</FieldLabel>
                <Textarea
                  id="caption-notes"
                  maxLength={2000}
                  onChange={(event) => updateValue("notes", event.target.value)}
                  placeholder="Contexto, aprobaciones o instrucciones para el equipo"
                  rows={3}
                  value={values.notes}
                />
              </Field>
            </FieldGroup>
            {saveError ? <FieldError>{saveError}</FieldError> : null}
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? (
                <RefreshCw className="animate-spin" data-icon="inline-start" />
              ) : (
                <Save aria-hidden="true" data-icon="inline-start" />
              )}
              {caption ? "Guardar cambios" : "Guardar caption"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
