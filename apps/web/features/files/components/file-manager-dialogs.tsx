"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, FileText, Image, Video } from "lucide-react"
import { filesApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { FileAsset, FileFolder } from "@/features/files/types/files"

type ManagedItem = (FileAsset | FileFolder) & { isFolder?: boolean }

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
  useEffect(() => setName(item?.name ?? ""), [item])
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar</DialogTitle>
          <DialogDescription>
            Elige un nombre claro para encontrarlo después.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="brand-secondary">
            Cancelar
          </Button>
          <Button disabled={!name.trim()} onClick={() => void onConfirm(name)}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function FileMoveDialog({
  folders,
  item,
  onConfirm,
  onOpenChange,
  open,
}: {
  folders: FileFolder[]
  item: ManagedItem | null
  onConfirm: (folderId: string | null) => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [value, setValue] = useState("root")
  useEffect(() => setValue("root"), [item])
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
            Mover {item?.isFolder ? "carpeta" : "archivo"}
          </DialogTitle>
          <DialogDescription>Elige la carpeta de destino.</DialogDescription>
        </DialogHeader>
        <Select onValueChange={setValue} value={value}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="brand-secondary">
            Cancelar
          </Button>
          <Button
            onClick={() => void onConfirm(value === "root" ? null : value)}
          >
            Mover
          </Button>
        </DialogFooter>
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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isBulkAction ? "Eliminar archivos seleccionados" : "Eliminar"}
          </DialogTitle>
          <DialogDescription>
            {isBulkAction
              ? `${selectedCount} ${selectedCount === 1 ? "archivo dejará" : "archivos dejarán"} de estar disponible hasta que los restaures.`
              : `${item?.name} dejará de estar disponible hasta que lo restaures.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="brand-secondary">
            Cancelar
          </Button>
          <Button onClick={() => void onConfirm()} variant="destructive">
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
