"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  Bot,
  FilePenLine,
  List,
  LoaderCircle,
  Pencil,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react"

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { ApiError, captionsApi } from "@workspace/api-client"
import type {
  Caption,
  CaptionDraft,
  CaptionFilters,
  CaptionMetrics,
  CaptionSourceType,
  CaptionStatus,
} from "@/features/captions/types/captions"

const initialFilters: CaptionFilters = {
  query: "",
  sourceType: "all",
  status: "all",
}

type EditorTarget = Caption | "new" | null

const sourceMeta: Record<
  CaptionSourceType,
  { label: string; icon: typeof FilePenLine }
> = {
  manual: { label: "Manual", icon: FilePenLine },
  ai: { label: "AI", icon: Sparkles },
}

const statusMeta: Record<
  CaptionStatus,
  { label: string; variant: "success" | "neutral" | "warning" }
> = {
  active: { label: "Activo", variant: "success" },
  draft: { label: "Borrador", variant: "neutral" },
  archived: { label: "Archivado", variant: "warning" },
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function normalizeTags(value: string) {
  const uniqueTags = new Map<string, string>()

  for (const rawTag of value.split(",")) {
    const tag = rawTag.trim()
    if (tag) uniqueTags.set(tag.toLocaleLowerCase("es"), tag)
  }

  return [...uniqueTags.values()]
}

function CaptionMetricsGrid({ metrics }: { metrics: CaptionMetrics }) {
  const items = [
    { label: "Total", value: metrics.total, icon: List },
    { label: "Con AI", value: metrics.ai, icon: Bot },
    { label: "Manuales", value: metrics.manual, icon: FilePenLine },
    { label: "Activos", value: metrics.active, icon: Sparkles },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ label, value, icon: Icon }) => (
        <Card key={label} variant="subtle">
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
            <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CaptionsLoading() {
  return (
    <div aria-busy="true" className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex flex-1 flex-wrap gap-2">
          <Skeleton className="h-9 min-w-64 flex-1" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["total", "ai", "manual", "active"].map((key) => (
          <Skeleton className="h-24" key={key} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {["one", "two", "three", "four"].map((key) => (
          <Skeleton className="h-64" key={key} />
        ))}
      </div>
    </div>
  )
}

function CaptionCard({
  caption,
  onDelete,
  onEdit,
}: {
  caption: Caption
  onDelete: (caption: Caption) => void
  onEdit: (caption: Caption) => void
}) {
  const source = sourceMeta[caption.sourceType]
  const SourceIcon = source.icon
  const status = statusMeta[caption.status]

  return (
    <Card className="h-full" variant="subtle">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate">{caption.name}</CardTitle>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SourceIcon className="size-3.5" />
              {source.label}
            </p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {caption.content}
        </p>
        {caption.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {caption.tags.map((tag) => (
              <Badge key={tag} variant="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        {caption.notes ? (
          <p className="border-l-2 border-border pl-3 text-sm text-muted-foreground">
            {caption.notes}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Actualizado {formatUpdatedAt(caption.updatedAt)}
          </p>
          <div className="flex items-center gap-1">
            <Button
              aria-label={`Editar ${caption.name}`}
              onClick={() => onEdit(caption)}
              size="icon-sm"
              variant="ghost"
            >
              <Pencil />
            </Button>
            <Button
              aria-label={`Eliminar ${caption.name}`}
              onClick={() => onDelete(caption)}
              size="icon-sm"
              variant="ghost"
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CaptionEditorDialog({
  caption,
  onClose,
  onSave,
  pending,
}: {
  caption: EditorTarget
  onClose: () => void
  onSave: (draft: CaptionDraft) => void
  pending: boolean
}) {
  const isEditing = caption !== null && caption !== "new"

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    const content = String(form.get("content") ?? "").trim()
    const notes = String(form.get("notes") ?? "").trim()
    const tags = normalizeTags(String(form.get("tags") ?? ""))

    if (!name || !content) {
      toast.error("Nombre y contenido son obligatorios.")
      return
    }
    if (tags.length > 20 || tags.some((tag) => tag.length > 64)) {
      toast.error("Usa hasta 20 etiquetas de 64 caracteres como máximo.")
      return
    }

    onSave({
      name,
      content,
      notes: notes || null,
      tags,
      sourceType: String(form.get("sourceType")) as CaptionSourceType,
      status: String(form.get("status")) as CaptionStatus,
    })
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={caption !== null}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar caption" : "Nuevo caption"}
          </DialogTitle>
          <DialogDescription>
            Guarda una pieza reutilizable para este espacio de trabajo. No se
            publicará contenido desde aquí.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          key={isEditing ? caption.id : "new"}
          noValidate
          onSubmit={submit}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span>
              Nombre
              <span aria-hidden="true" className="ml-0.5 text-destructive">
                *
              </span>
            </span>
            <Input
              defaultValue={isEditing ? caption.name : ""}
              maxLength={120}
              name="name"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>
              Contenido
              <span aria-hidden="true" className="ml-0.5 text-destructive">
                *
              </span>
            </span>
            <Textarea
              defaultValue={isEditing ? caption.content : ""}
              maxLength={10000}
              name="content"
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Origen
              <Select
                defaultValue={isEditing ? caption.sourceType : "manual"}
                name="sourceType"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Estado
              <Select
                defaultValue={isEditing ? caption.status : "draft"}
                name="status"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="archived">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Etiquetas
            <Input
              defaultValue={isEditing ? caption.tags.join(", ") : ""}
              maxLength={1299}
              name="tags"
              placeholder="lanzamiento, instagram"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Separadas por comas; hasta 20.
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Notas{" "}
            <span className="text-xs font-normal text-muted-foreground">
              Opcionales
            </span>
            <Textarea
              defaultValue={isEditing ? (caption.notes ?? "") : ""}
              maxLength={2000}
              name="notes"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              disabled={pending}
              onClick={onClose}
              type="button"
              variant="brand-secondary"
            >
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {isEditing ? "Guardar cambios" : "Crear caption"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCaptionDialog({
  caption,
  onClose,
  onConfirm,
  pending,
}: {
  caption: Caption | null
  onClose: () => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={caption !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar caption</DialogTitle>
          <DialogDescription>
            {caption
              ? `Eliminarás “${caption.name}” de la biblioteca del espacio de trabajo. Esta acción no se puede deshacer.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            disabled={pending}
            onClick={onClose}
            variant="brand-secondary"
          >
            Cancelar
          </Button>
          <Button disabled={pending} onClick={onConfirm} variant="destructive">
            {pending ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CaptionsLibraryPage() {
  const [captions, setCaptions] = useState<Caption[]>([])
  const [filters, setFilters] = useState<CaptionFilters>(initialFilters)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorTarget>(null)
  const [captionToDelete, setCaptionToDelete] = useState<Caption | null>(null)

  async function loadCaptions() {
    setLoading(true)
    setError(null)
    try {
      const response = await captionsApi.list()
      setCaptions(response.captions)
    } catch (nextError) {
      setError(
        nextError instanceof ApiError && nextError.status === 403
          ? "No tienes acceso a la biblioteca de captions."
          : "No se pudo cargar la biblioteca. Ningún caption fue modificado."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCaptions()
  }, [])

  const filteredCaptions = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("es")
    return captions.filter((caption) => {
      const matchesQuery = !query || [caption.name, caption.content, caption.notes ?? "", ...caption.tags]
        .join(" ").toLocaleLowerCase("es").includes(query)
      return matchesQuery &&
        (filters.sourceType === "all" || caption.sourceType === filters.sourceType) &&
        (filters.status === "all" || caption.status === filters.status)
    })
  }, [captions, filters])
  const metrics = useMemo(() => captions.reduce<CaptionMetrics>(
    (current, caption) => ({
      total: current.total + 1,
      ai: current.ai + (caption.sourceType === "ai" ? 1 : 0),
      manual: current.manual + (caption.sourceType === "manual" ? 1 : 0),
      active: current.active + (caption.status === "active" ? 1 : 0),
    }),
    { total: 0, ai: 0, manual: 0, active: 0 }
  ), [captions])

  async function saveCaption(draft: CaptionDraft) {
    setPending(true)
    try {
      if (editor === "new") {
        const caption = await captionsApi.create(draft)
        setCaptions((current) => [caption, ...current])
        toast.success("Caption creado.")
      } else if (editor) {
        const updatedCaption = await captionsApi.update(editor.id, draft)
        setCaptions((current) =>
          current.map((caption) =>
            caption.id === updatedCaption.id ? updatedCaption : caption
          )
        )
        toast.success("Cambios guardados.")
      }
      setEditor(null)
    } catch {
      toast.error("No se pudo guardar el caption.")
    } finally {
      setPending(false)
    }
  }

  async function confirmDelete() {
    if (!captionToDelete) return
    setPending(true)
    try {
      await captionsApi.remove(captionToDelete.id)
      setCaptions((current) => current.filter((caption) => caption.id !== captionToDelete.id))
      setCaptionToDelete(null)
      toast.success("Caption eliminado.")
    } catch {
      toast.error("No se pudo eliminar el caption.")
    } finally {
      setPending(false)
    }
  }

  if (loading) return <CaptionsLoading />

  if (error) {
    return (
      <Card variant="subtle">
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-5 text-destructive"
            />
            <div>
              <p className="font-semibold">No se pudo cargar Captions</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button onClick={() => void loadCaptions()} variant="brand-secondary">
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-7">
      <div className="flex justify-end">
        <Button onClick={() => setEditor("new")} size="lg">
          <Plus data-icon="inline-start" />
          Nuevo caption
        </Button>
      </div>
      <section aria-label="Biblioteca de captions" className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <div className="relative min-w-56 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Buscar captions"
              className="pl-9"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  query: event.target.value,
                }))
              }
              placeholder="Buscar por nombre, contenido o nota"
              value={filters.query}
            />
          </div>
          <Select
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                sourceType: value as CaptionFilters["sourceType"],
              }))
            }
            value={filters.sourceType}
          >
            <SelectTrigger aria-label="Filtrar por origen">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los orígenes</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                status: value as CaptionFilters["status"],
              }))
            }
            value={filters.status}
          >
            <SelectTrigger aria-label="Filtrar por estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="archived">Archivado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CaptionMetricsGrid metrics={metrics} />

        <div className="flex justify-end">
          {filters.query ||
          filters.sourceType !== "all" ||
          filters.status !== "all" ? (
            <Button onClick={() => setFilters(initialFilters)} variant="ghost">
              Limpiar filtros
            </Button>
          ) : null}
        </div>

        {filteredCaptions.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredCaptions.map((caption) => (
              <CaptionCard
                caption={caption}
                key={caption.id}
                onDelete={setCaptionToDelete}
                onEdit={setEditor}
              />
            ))}
          </div>
        ) : (
          <Card variant="subtle">
            <CardContent>
              <EmptyState
                description={
                  captions.length === 0
                    ? "Crea el primer caption reutilizable para este espacio de trabajo."
                    : "Prueba con otra búsqueda o limpia los filtros para ver la biblioteca completa."
                }
                icon={PenLine}
                title={
                  captions.length === 0
                    ? "Todavía no hay captions"
                    : "No encontramos captions"
                }
              />
            </CardContent>
          </Card>
        )}

        <CaptionEditorDialog
          caption={editor}
          onClose={() => setEditor(null)}
          onSave={(draft) => void saveCaption(draft)}
          pending={pending}
        />
        <DeleteCaptionDialog
          caption={captionToDelete}
          onClose={() => setCaptionToDelete(null)}
          onConfirm={() => void confirmDelete()}
          pending={pending}
        />
      </section>
    </div>
  )
}
