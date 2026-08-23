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
import { useTranslations } from "next-intl"

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
  const t = useTranslations("files")
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("uploadTitle")}</DialogTitle>
          <DialogDescription>
            Se guardará de forma privada y solo será visible para las personas
            con acceso a este espacio de trabajo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 border-y border-border py-4">
          <p className="text-sm font-medium">{t("allowedFormats")}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              [t("formats.images"), "JPG, PNG, WebP, GIF, AVIF"],
              [t("formats.media"), "MP4, WebM, MOV · MP3, WAV, M4A, OGG"],
              [
                t("formats.documents"),
                "PDF, TXT, MD, JSON, CSV, RTF, DOC, DOCX, ODT",
              ],
              [t("formats.archives"), "XLS, XLSX, ODS · ZIP, 7Z, RAR, TAR, GZ"],
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
            <Upload data-icon="inline-start" /> {t("selectFile")}
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="brand-secondary"
          >
            {t("close")}
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
  const t = useTranslations("files")
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newFolderTitle")}</DialogTitle>
          <DialogDescription>{t("foldersHint")}</DialogDescription>
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
              {t("name")}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                aria-required="true"
                id="file-folder-name"
                onChange={(event) => onNameChange(event.target.value)}
                placeholder={t("folderNamePlaceholder")}
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
              {t("cancel")}
            </Button>
            <Button disabled={!name.trim() || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FolderPlus data-icon="inline-start" />
              )}
              {pending ? t("creating") : t("createFolder")}
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
  const t = useTranslations("files")
  const fallback =
    item?.kind === "image" ? Image : item?.kind === "video" ? Video : FileText
  const Fallback = fallback
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item?.name}</DialogTitle>
          <DialogDescription>{t("previewDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-muted/50">
          {item?.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- la biblioteca sirve las imágenes desde la API, fuera del optimizador de Next.
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
              {t("download")}
            </a>
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="brand-secondary">
            {t("close")}
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
  const t = useTranslations("files")
  const type = t(`kind.${item?.kind ?? "document"}`)
  const details = [
    [t("info.type"), type],
    [t("info.format"), item?.mimeType ?? t("unavailable")],
    [t("info.size"), item?.size ?? t("unavailable")],
    [t("info.updatedAt"), item?.updatedAt ?? t("unavailable")],
    [t("info.updatedBy"), item?.owner ?? t("unavailable")],
  ]

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("infoTitle")}</DialogTitle>
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
            {t("close")}
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
  const t = useTranslations("files")
  const [name, setName] = useState("")
  /** La extensión identifica el formato: se conserva y queda fuera del campo editable. */
  const extension = item && "kind" in item ? fileExtension(item.name) : ""
  const [lastItemId, setLastItemId] = useState(item?.id ?? null)

  // Ajustar el estado durante el render en vez de en un efecto: evita el
  // segundo render que encadena `setState` dentro de `useEffect`.
  if ((item?.id ?? null) !== lastItemId) {
    setLastItemId(item?.id ?? null)
    setName(item ? item.name.slice(0, item.name.length - extension.length) : "")
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("renameTitle")}</DialogTitle>
          <DialogDescription>{t("nameHint")}</DialogDescription>
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
              {t("name")}
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
              {t("cancel")}
            </Button>
            <Button disabled={!name.trim()} type="submit">
              <Save data-icon="inline-start" /> {t("save")}
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
  const t = useTranslations("files")
  const [value, setValue] = useState("root")
  const [wasOpen, setWasOpen] = useState(open)
  const isBulkAction = selectedCount !== undefined

  // Ajustar el estado durante el render en vez de en un efecto: evita el
  // segundo render que encadena `setState` dentro de `useEffect`.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setValue("root")
  }
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
              ? t("moveSelected")
              : `Mover ${item?.isFolder ? "carpeta" : "archivo"}`}
          </DialogTitle>
          <DialogDescription>
            {isBulkAction
              ? `Elige la carpeta de destino para ${selectedCount} ${selectedCount === 1 ? "archivo" : "archivos"}.`
              : t("chooseFolder")}
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
              {t("destination")}
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
                  <SelectItem value="root">{t("rootFolder")}</SelectItem>
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
              {t("cancel")}
            </Button>
            <Button type="submit">
              <FolderInput data-icon="inline-start" /> {t("move")}
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
  const t = useTranslations("files")
  const isBulkAction = selectedCount !== undefined
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {isBulkAction ? t("deleteSelected") : t("deletePermanently")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulkAction
              ? `${selectedCount} ${selectedCount === 1 ? "elemento se eliminará" : "elementos se eliminarán"} permanentemente. Esta acción no se puede deshacer.`
              : `${item?.name} se eliminará permanentemente. Esta acción no se puede deshacer.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="brand-secondary">
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onConfirm()}
            variant="destructive"
          >
            <Trash2 data-icon="inline-start" /> {t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
