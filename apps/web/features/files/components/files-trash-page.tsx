"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Folder, RotateCcw, Trash2 } from "lucide-react"
import { filesApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { toast } from "@workspace/ui/components/toast"
import type { PortalFilesResponse } from "@workspace/contracts"

export function FilesTrashPage() {
  const [data, setData] = useState<PortalFilesResponse | null>(null)
  const load = useCallback(async () => {
    try {
      setData(await filesApi.trash())
    } catch {
      setData({ canManage: false, folders: [], files: [] })
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  async function action(kind: "restore" | "purge", id: string, folder = false) {
    try {
      if (kind === "restore")
        folder ? await filesApi.restoreFolder(id) : await filesApi.restore(id)
      else folder ? await filesApi.purgeFolder(id) : await filesApi.purge(id)
      await load()
      toast.success(
        kind === "restore"
          ? "Elemento restaurado"
          : "Elemento eliminado permanentemente"
      )
    } catch {
      toast.error("No se pudo completar la acción")
    }
  }
  if (!data) return null
  const empty = data.folders.length === 0 && data.files.length === 0
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Papelera</h2>
          <p className="text-sm text-muted-foreground">
            Restaura elementos o elimínalos permanentemente.
          </p>
        </div>
        <Button asChild variant="brand-secondary">
          <Link href="/portal/files">Volver a archivos</Link>
        </Button>
      </div>
      {empty ? (
        <EmptyState
          description="Los archivos y carpetas enviados a papelera aparecerán aquí."
          icon={Trash2}
          title="La papelera está vacía"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.folders.map((folder) => (
            <TrashCard
              key={folder.id}
              icon={Folder}
              name={folder.name}
              onPurge={() => action("purge", folder.id, true)}
              onRestore={() => action("restore", folder.id, true)}
            />
          ))}
          {data.files.map((file) => (
            <TrashCard
              key={file.id}
              icon={FileText}
              name={file.name}
              onPurge={() => action("purge", file.id)}
              onRestore={() => action("restore", file.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TrashCard({
  icon: Icon,
  name,
  onPurge,
  onRestore,
}: {
  icon: typeof FileText
  name: string
  onPurge: () => void
  onRestore: () => void
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-muted-foreground" />
          <CardTitle className="truncate">{name}</CardTitle>
        </div>
        <CardDescription>En papelera</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={onRestore} size="sm" variant="brand-secondary">
          <RotateCcw data-icon="inline-start" />
          Restaurar
        </Button>
        <Button onClick={onPurge} size="sm" variant="destructive">
          <Trash2 data-icon="inline-start" />
          Purgar
        </Button>
      </CardContent>
    </Card>
  )
}
