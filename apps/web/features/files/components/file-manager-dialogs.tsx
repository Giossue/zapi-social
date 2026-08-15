"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Download,
  FileText,
  FolderInput,
  FolderPlus,
  Image,
  Save,
  Trash2,
  Upload,
  Video,
} from "lucide-react"
import { filesApi } from "@workspace/api-client"
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
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
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
import type { FileAsset, FileFolder } from "@/features/files/types/files"

type ManagedItem = (FileAsset | FileFolder) & { isFolder?: boolean }

/** Sufijo `.ext` de un nombre, vacío si no lo tiene o si el punto abre el nombre. */
function fileExtension(name: string) {
  const dotIndex = name.lastIndexOf(".")
  return dotIndex > 0 ? name.slice(dotIndex) : ""
}

export function FileUploadDialog({
  onOpenChange,
  onSelect,
  open,
}: {
  onOpenChange: (open: boolean) => void
  onSelect: (file: File) => void
  open: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir archivos</DialogTitle>
          <DialogDescription>
            Se guardará de forma privada y solo será visible para las personas
            con acceso a este espacio de trabajo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 border-y border-border py-4">
          <p className="text-sm font-medium">Formatos permitidos</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Imágenes", "JPG, PNG, WebP, GIF, AVIF"],
              ["Vídeo y audio", "MP4, WebM, MOV · MP3, WAV, M4A, OGG"],
              ["Documentos", "PDF, TXT, MD, JSON, CSV, RTF, DOC, DOCX, ODT"],
              ["Hojas y comprimidos", "XLS, XLSX, ODS · ZIP, 7Z, RAR, TAR, GZ"],
            ].map(([label, formats]) => (
              <div className="flex flex-col gap-1" key={label}>
                <dt className="font-medium">{label}</dt>
                <dd className="text-muted-foreground">{formats}</dd>
              </div>
            ))}
          </dl>
        </div>
        <DialogFooter>
          <input
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onSelect(file)
              event.currentTarget.value = ""
            }}
            ref={inputRef}
            type="file"
          />
          <Button onClick={() => inputRef.current?.click()} type="button">
            <Upload data-icon="inline-start" /> Seleccionar archivo
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="brand-secondary"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function FileFolderDialog({
  name,
  onConfirm,
  onNameChange,
  onOpenChange,
  open,
  pending = false,
}: {
  name: string
  onConfirm: () => void
  onNameChange: (name: string) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  pending?: boolean
}) {
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva carpeta</DialogTitle>
          <DialogDescription>
            Organiza los archivos de este espacio de trabajo.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim() && !pending) onConfirm()
          }}
        >
          <Field>
            <FieldLabel htmlFor="file-folder-name">
              Nombre
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                aria-required="true"
                id="file-folder-name"
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Nombre de carpeta"
                value={name}
              />
            </InputGroup>
          </Field>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              Cancelar
            </Button>
            <Button disabled={!name.trim() || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FolderPlus data-icon="inline-start" />
              )}
              {pending ? "Creando..." : "Crear carpeta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FilePreviewDialog({
  item,
  onOpenChange,
  open,
}: {
  item: FileAsset | null
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const fallback =
    item?.kind === "image" ? Image : item?.kind === "video" ? Video : FileText
  const Fallback = fallback
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item?.name}</DialogTitle>
          <DialogDescription>Vista privada del archivo.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-muted/50">
          {item?.kind === "image" ? (
            <img
              alt={item.name}
              className="max-h-[60dvh] max-w-full object-contain"
              src={filesApi.previewUrl(item.id)}
            />
          ) : item?.kind === "video" ? (
            <video
              className="max-h-[60dvh] max-w-full"
              controls
              src={filesApi.previewUrl(item.id)}
            />
          ) : item?.mimeType?.startsWith("audio/") ? (
            <audio
              className="w-full"
              controls
              src={filesApi.previewUrl(item.id)}
            />
          ) : item?.mimeType === "application/pdf" ? (
            <iframe
              className="h-[60dvh] w-full bg-background"
              src={filesApi.previewUrl(item.id)}
              title={item.name}
            />
          ) : (
            <Fallback className="size-16 text-muted-foreground" />
          )}
        </div>
        <DialogFooter>
          <Button asChild variant="brand-secondary">
            <a href={item ? filesApi.downloadUrl(item.id) : undefined}>
              <Download data-icon="inline-start" />
              Descargar
            </a>
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="brand-secondary">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function FileInfoDialog({
  item,
  onOpenChange,
  open,
}: {
  item: FileAsset | null
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const type =
    item?.kind === "image"
      ? "Imagen"
      : item?.kind === "video"
        ? "Vídeo"
        : "Documento"
  const details = [
    ["Tipo", type],
    ["Formato", item?.mimeType ?? "No disponible"],
    ["Tamaño", item?.size ?? "No disponible"],
    ["Última actualización", item?.updatedAt ?? "No disponible"],
    ["Actualizado por", item?.owner ?? "No disponible"],
  ]

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Información del archivo</DialogTitle>
          <DialogDescription className="break-words">
            {item?.name}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3 text-sm">
          {details.map(([label, value]) => (
            <div className="flex items-start justify-between gap-4" key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="brand-secondary">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function FileRenameDialog({
  item,
  onConfirm,
  onOpenChange,
  open,
}: {
  item: ManagedItem | null
  onConfirm: (name: string) => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [name, setName] = useState("")
  /** La extensión identifica el formato: se conserva y queda fuera del campo editable. */
  const extension = item && "kind" in item ? fileExtension(item.name) : ""
  useEffect(
    () =>
      setName(
        item ? item.name.slice(0, item.name.length - extension.length) : ""
      ),
    [extension.length, item]
  )
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar</DialogTitle>
          <DialogDescription>
            Elige un nombre claro para encontrarlo después.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) void onConfirm(`${name.trim()}${extension}`)
          }}
        >
          <Field>
            <FieldLabel htmlFor="file-rename-name">
              Nombre
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                aria-required="true"
                autoFocus
                id="file-rename-name"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              {extension ? (
                <InputGroupAddon align="inline-end">
                  <span className="text-muted-foreground">{extension}</span>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          </Field>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              Cancelar
            </Button>
            <Button disabled={!name.trim()} type="submit">
              <Save data-icon="inline-start" /> Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FileMoveDialog({
  folders,
  item,
  selectedCount,
  onConfirm,
  onOpenChange,
  open,
}: {
  folders: FileFolder[]
  item: ManagedItem | null
  selectedCount?: number
  onConfirm: (folderId: string | null) => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [value, setValue] = useState("root")
  const isBulkAction = selectedCount !== undefined
  useEffect(() => {
    if (open) setValue("root")
  }, [open])
  const descendants = useMemo(() => {
    if (!item?.isFolder) return new Set<string>()
    const byParent = new Map<string, string[]>()
    for (const folder of folders)
      if (folder.parentFolderId)
        byParent.set(folder.parentFolderId, [
          ...(byParent.get(folder.parentFolderId) ?? []),
          folder.id,
        ])
    const ids = new Set([item.id])
    const pending = [item.id]
    while (pending.length)
      for (const id of byParent.get(pending.pop()!) ?? [])
        if (!ids.has(id)) {
          ids.add(id)
          pending.push(id)
        }
    return ids
  }, [folders, item])
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isBulkAction
              ? "Mover archivos seleccionados"
              : `Mover ${item?.isFolder ? "carpeta" : "archivo"}`}
          </DialogTitle>
          <DialogDescription>
            {isBulkAction
              ? `Elige la carpeta de destino para ${selectedCount} ${selectedCount === 1 ? "archivo" : "archivos"}.`
              : "Elige la carpeta de destino."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void onConfirm(value === "root" ? null : value)
          }}
        >
          <Field>
            <FieldLabel htmlFor="file-move-destination">
              Destino
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </FieldLabel>
            <Select onValueChange={setValue} value={value}>
              <SelectTrigger aria-required="true" id="file-move-destination">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="root">Archivos</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem
                      disabled={descendants.has(folder.id)}
                      key={folder.id}
                      value={folder.id}
                    >
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              Cancelar
            </Button>
            <Button type="submit">
              <FolderInput data-icon="inline-start" /> Mover
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FileTrashDialog({
  item,
  selectedCount,
  onConfirm,
  onOpenChange,
  open,
}: {
  item: ManagedItem | null
  selectedCount?: number
  onConfirm: () => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const isBulkAction = selectedCount !== undefined
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {isBulkAction
              ? "Eliminar los elementos seleccionados"
              : "Eliminar permanentemente"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulkAction
              ? `${selectedCount} ${selectedCount === 1 ? "elemento se eliminará" : "elementos se eliminarán"} permanentemente. Esta acción no se puede deshacer.`
              : `${item?.name} se eliminará permanentemente. Esta acción no se puede deshacer.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="brand-secondary">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onConfirm()}
            variant="destructive"
          >
            <Trash2 data-icon="inline-start" /> Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
