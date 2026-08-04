"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ApiError, filesApi } from "@workspace/api-client"
import { toast } from "@workspace/ui/components/toast"
import Link from "next/link"
import {
  Clock,
  Download,
  Eye,
  FilePenLine,
  FileText,
  Folder,
  FolderPlus,
  FolderInput,
  Grid2X2,
  Image,
  List,
  MoreVertical,
  Search,
  Star,
  Upload,
  Trash2,
  Video,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import {
  FilesErrorState,
  FilesPermissionState,
} from "@/features/files/components/files-states"
import {
  FileMoveDialog,
  FilePreviewDialog,
  FileRenameDialog,
  FileTrashDialog,
} from "@/features/files/components/file-manager-dialogs"
import type {
  FileAsset,
  FileAssetKind,
  FileLibraryData,
} from "@/features/files/types/files"

type FilesView = "grid" | "list"
type AssetFilter = FileAssetKind | "all" | "ai"

const assetKindMeta: Record<
  FileAssetKind,
  { icon: typeof Image; label: string }
> = {
  document: { icon: FileText, label: "Documento" },
  image: { icon: Image, label: "Imagen" },
  video: { icon: Video, label: "Video" },
}

function assetMatches(
  asset: FileAsset,
  query: string,
  filter: AssetFilter,
  folderId: string | "all"
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("es")
  const matchesQuery =
    normalizedQuery.length === 0 ||
    asset.name.toLocaleLowerCase("es").includes(normalizedQuery)
  const matchesFilter =
    filter === "all" ||
    (filter === "ai" ? asset.generatedWithAi : asset.kind === filter)
  const matchesFolder = folderId === "all" || asset.folderId === folderId

  return matchesQuery && matchesFilter && matchesFolder
}

function AssetThumbnail({
  asset,
  fallbackClassName,
  imageClassName,
}: {
  asset: FileAsset
  fallbackClassName: string
  imageClassName: string
}) {
  const { icon: AssetIcon } = assetKindMeta[asset.kind]
  const [imageSource, setImageSource] = useState<
    "thumbnail" | "preview" | "unavailable"
  >(asset.thumbnailStatus === "ready" ? "thumbnail" : "preview")

  useEffect(() => {
    setImageSource(asset.thumbnailStatus === "ready" ? "thumbnail" : "preview")
  }, [asset.id, asset.thumbnailStatus])

  if (asset.kind !== "image" || imageSource === "unavailable")
    return <AssetIcon aria-hidden="true" className={fallbackClassName} />

  return (
    <img
      alt=""
      className={imageClassName}
      onError={() =>
        setImageSource((current) =>
          current === "thumbnail" ? "preview" : "unavailable"
        )
      }
      src={
        imageSource === "thumbnail"
          ? filesApi.thumbnailUrl(asset.id)
          : filesApi.previewUrl(asset.id)
      }
    />
  )
}

function AssetCard({
  asset,
  selected,
  onSelect,
  onToggleStar,
  onPreview,
  onRename,
  onMove,
  onTrash,
}: {
  asset: FileAsset
  selected: boolean
  onSelect: (id: string) => void
  onToggleStar: (asset: FileAsset) => void
  onPreview: (asset: FileAsset) => void
  onRename: (asset: FileAsset) => void
  onMove: (asset: FileAsset) => void
  onTrash: (asset: FileAsset) => void
}) {
  const { label } = assetKindMeta[asset.kind]

  return (
    <Card className="group/file" size="sm">
      <CardContent>
        <div className="relative flex h-36 items-center justify-center rounded-lg bg-muted/50">
          <AssetThumbnail
            asset={asset}
            fallbackClassName="size-12 text-muted-foreground"
            imageClassName="h-full w-full rounded-lg object-cover"
          />
          <Checkbox
            aria-label={`Seleccionar ${asset.name}`}
            checked={selected}
            className="absolute top-2 left-2"
            onCheckedChange={() => onSelect(asset.id)}
          />
          <Button
            aria-label={`${asset.starred ? "Quitar de favoritos" : "Añadir a favoritos"} ${asset.name}`}
            className={`absolute top-2 right-2 opacity-0 group-hover/file:opacity-100 focus-visible:opacity-100 ${
              asset.starred ? "opacity-100" : ""
            }`}
            onClick={() => onToggleStar(asset)}
            size="icon-sm"
            variant="secondary"
          >
            <Star className={asset.starred ? "fill-current" : undefined} />
          </Button>
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{label}</span>
            <span>{asset.size}</span>
          </div>
        </div>
      </CardContent>
      <CardHeader>
        <CardTitle className="truncate">{asset.name}</CardTitle>
        <CardDescription className="truncate">
          Actualizado {asset.updatedAt} por {asset.owner}
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Acciones de ${asset.name}`}
                size="icon-sm"
                variant="ghost"
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => onPreview(asset)}>
                  <Eye />
                  Vista previa
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={filesApi.downloadUrl(asset.id)}>
                    <Download />
                    Descargar
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onRename(asset)}>
                  <FilePenLine />
                  Renombrar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(asset)}>
                  <FolderInput />
                  Mover
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={() => onTrash(asset)}
                  variant="destructive"
                >
                  <Trash2 />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
    </Card>
  )
}

function AssetsTable({
  assets,
  selectedAssetIds,
  onSelect,
  onPreview,
  onRename,
  onMove,
  onTrash,
}: {
  assets: readonly FileAsset[]
  selectedAssetIds: readonly string[]
  onSelect: (id: string) => void
  onPreview: (asset: FileAsset) => void
  onRename: (asset: FileAsset) => void
  onMove: (asset: FileAsset) => void
  onTrash: (asset: FileAsset) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <span className="sr-only">Seleccionar</span>
          </TableHead>
          <TableHead>Archivo</TableHead>
          <TableHead className="hidden md:table-cell">Tipo</TableHead>
          <TableHead className="hidden lg:table-cell">Actualizado</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => {
          const { label } = assetKindMeta[asset.kind]
          const selected = selectedAssetIds.includes(asset.id)

          return (
            <TableRow key={asset.id}>
              <TableCell>
                <Checkbox
                  aria-label={`Seleccionar ${asset.name}`}
                  checked={selected}
                  onCheckedChange={() => onSelect(asset.id)}
                />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <AssetThumbnail
                    asset={asset}
                    fallbackClassName="size-5 shrink-0 text-muted-foreground"
                    imageClassName="size-8 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset.size}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {label}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {asset.updatedAt}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`Acciones de ${asset.name}`}
                      size="icon-sm"
                      variant="brand-secondary"
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onPreview(asset)}>
                      <Eye />
                      Vista previa
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={filesApi.downloadUrl(asset.id)}>
                        <Download />
                        Descargar
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onRename(asset)}>
                      <FilePenLine />
                      Renombrar
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(asset)}>
                      <FolderInput />
                      Mover
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onTrash(asset)}
                      variant="destructive"
                    >
                      <Trash2 />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function formatSize(sizeBytes: number) {
  return sizeBytes < 1024 * 1024
    ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
    : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FilesLibraryPage() {
  const [library, setLibrary] = useState<FileLibraryData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState("")
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all")
  const [folderId, setFolderId] = useState<string | "all">("all")
  const [view, setView] = useState<FilesView>("grid")
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [bulkTrashOpen, setBulkTrashOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [previewAsset, setPreviewAsset] = useState<FileAsset | null>(null)
  const [renameItem, setRenameItem] = useState<
    (FileAsset | FileLibraryData["folders"][number]) | null
  >(null)
  const [moveItem, setMoveItem] = useState<
    | ((FileAsset | FileLibraryData["folders"][number]) & {
        isFolder?: boolean
      })
    | null
  >(null)
  const [trashItem, setTrashItem] = useState<
    | ((FileAsset | FileLibraryData["folders"][number]) & {
        isFolder?: boolean
      })
    | null
  >(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadLibrary = useCallback(async () => {
    try {
      const data = await filesApi.list()
      setLoadError(false)
      setLibrary({
        canView: true,
        canUpload: data.canManage,
        folders: data.folders.map((folder) => ({
          ...folder,
          size: formatSize(folder.sizeBytes),
          updatedAt: new Intl.DateTimeFormat("es", {
            dateStyle: "medium",
          }).format(new Date(folder.updatedAt)),
        })),
        assets: data.files.map((asset) => ({
          id: asset.id,
          name: asset.name,
          folderId: asset.folderId,
          kind:
            asset.kind === "image" || asset.kind === "video"
              ? asset.kind
              : "document",
          mimeType: asset.mimeType,
          size: formatSize(asset.sizeBytes),
          dimensions: null,
          owner: asset.owner,
          updatedAt: new Intl.DateTimeFormat("es", {
            dateStyle: "medium",
          }).format(new Date(asset.modifiedAt)),
          shared: false,
          generatedWithAi: false,
          starred: asset.starred,
          thumbnailStatus: asset.thumbnailStatus,
        })),
      })
    } catch (error) {
      setLoadError(!(error instanceof ApiError && error.status === 403))
      setLibrary({
        canView: false,
        canUpload: false,
        folders: [],
        assets: [],
      })
    }
  }, [])

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  async function uploadSelectedFile(file: File) {
    try {
      const upload = await filesApi.startUpload({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        folderId: folderId === "all" ? null : folderId,
      })
      await filesApi.upload(upload.id, file)
      setUploadDialogOpen(false)
      await loadLibrary()
      toast.success("Archivo subido")
    } catch {
      toast.error("No se pudo subir el archivo")
    }
  }

  async function createFolder() {
    const name = folderName.trim()
    if (!name) return
    try {
      await filesApi.createFolder({
        name,
        parentFolderId: folderId === "all" ? null : folderId,
      })
      setFolderName("")
      setFolderDialogOpen(false)
      await loadLibrary()
      toast.success("Carpeta creada")
    } catch {
      toast.error("No se pudo crear la carpeta")
    }
  }

  const assets = useMemo(
    () =>
      (library?.assets ?? []).filter((asset) =>
        assetMatches(asset, query, assetFilter, folderId)
      ),
    [assetFilter, folderId, library?.assets, query]
  )
  const folderById = useMemo(
    () =>
      new Map((library?.folders ?? []).map((folder) => [folder.id, folder])),
    [library?.folders]
  )
  const currentFolderPath = useMemo(() => {
    if (folderId === "all") return []
    const path = [] as NonNullable<typeof library>["folders"][number][]
    let current = folderById.get(folderId)
    while (current) {
      path.unshift(current)
      current = current.parentFolderId
        ? folderById.get(current.parentFolderId)
        : undefined
    }
    return path
  }, [folderById, folderId])
  const visibleFolders = useMemo(
    () =>
      (library?.folders ?? []).filter(
        (folder) =>
          folder.parentFolderId === (folderId === "all" ? null : folderId)
      ),
    [folderId, library?.folders]
  )
  const hasFilters = Boolean(query.trim()) || assetFilter !== "all"

  function toggleAsset(id: string) {
    setSelectedAssetIds((current) =>
      current.includes(id)
        ? current.filter((assetId) => assetId !== id)
        : [...current, id]
    )
  }

  async function toggleStar(asset: FileAsset) {
    try {
      await filesApi.update(asset.id, { starred: !asset.starred })
      await loadLibrary()
      toast.success(
        asset.starred ? "Quitado de favoritos" : "Añadido a favoritos"
      )
    } catch {
      toast.error("No se pudo actualizar favoritos")
    }
  }

  async function renameManagedItem(name: string) {
    if (!renameItem) return
    try {
      if ("kind" in renameItem) await filesApi.update(renameItem.id, { name })
      else await filesApi.updateFolder(renameItem.id, { name })
      setRenameItem(null)
      await loadLibrary()
      toast.success("Nombre actualizado")
    } catch {
      toast.error("No se pudo cambiar el nombre")
    }
  }

  async function moveManagedItem(parentFolderId: string | null) {
    if (!moveItem) return
    try {
      if (moveItem.isFolder)
        await filesApi.updateFolder(moveItem.id, { parentFolderId })
      else await filesApi.update(moveItem.id, { folderId: parentFolderId })
      setMoveItem(null)
      await loadLibrary()
      toast.success("Elemento movido")
    } catch {
      toast.error("No se pudo mover el elemento")
    }
  }

  async function trashManagedItem() {
    if (!trashItem) return
    try {
      if (trashItem.isFolder) await filesApi.removeFolder(trashItem.id)
      else await filesApi.remove(trashItem.id)
      if (folderId !== "all" && trashItem.id === folderId) setFolderId("all")
      setTrashItem(null)
      await loadLibrary()
      toast.success("Elemento enviado a papelera")
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === "FILE_IN_USE_BY_PUBLISHING"
          ? "Este archivo se usa en Publishing y no puede enviarse a papelera."
          : "No se pudo enviar el elemento a papelera"
      )
    }
  }

  async function trashSelectedAssets() {
    const ids = [...selectedAssetIds]
    if (!ids.length) return
    try {
      const results = await Promise.allSettled(
        ids.map((id) => filesApi.remove(id))
      )
      const failed = results.filter((result) => result.status === "rejected")
      setBulkTrashOpen(false)
      await loadLibrary()
      setSelectedAssetIds([])
      if (failed.length) {
        toast.error(
          failed.length === ids.length
            ? "No se pudo eliminar ningún archivo"
            : "Algunos archivos no se pudieron eliminar"
        )
        return
      }
      toast.success(
        ids.length === 1 ? "Archivo eliminado" : "Archivos eliminados"
      )
    } catch {
      toast.error("No se pudieron eliminar los archivos")
    }
  }

  if (library === null) return null
  if (loadError)
    return <FilesErrorState onRetry={() => void loadLibrary()} section="biblioteca" />
  if (!library.canView) return <FilesPermissionState mode="library" />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <InputGroup className="max-w-xl">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Buscar archivos y carpetas"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar archivos y carpetas"
            value={query}
          />
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="brand-secondary">
            <Link href="/portal/files/trash">Papelera</Link>
          </Button>
          <Button
            disabled={!library.canUpload}
            onClick={() => setFolderDialogOpen(true)}
            variant="brand-secondary"
          >
            <FolderPlus data-icon="inline-start" />
            Nueva carpeta
          </Button>
          <Button
            disabled={!library.canUpload}
            onClick={() => setUploadDialogOpen(true)}
          >
            <Upload data-icon="inline-start" />
            Subir archivos
          </Button>
        </div>
      </div>

      {currentFolderPath.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button onClick={() => setFolderId("all")} type="button">
                  Archivos
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {currentFolderPath.map((folder, index) => (
              <BreadcrumbItem key={folder.id}>
                <BreadcrumbSeparator />
                {index === currentFolderPath.length - 1 ? (
                  <BreadcrumbPage>{folder.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <button
                      onClick={() => setFolderId(folder.id)}
                      type="button"
                    >
                      {folder.name}
                    </button>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      {visibleFolders.length > 0 ? (
        <section
          className="flex flex-col gap-2"
          aria-labelledby="folders-heading"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium" id="folders-heading">
              Carpetas
            </h2>
            <span className="text-sm text-muted-foreground">
              {visibleFolders.length} carpetas
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleFolders.map((folder) => (
              <Card key={folder.id} size="sm">
                <CardHeader>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Folder aria-hidden="true" className="size-4.5" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="truncate leading-none">
                        {folder.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {folder.fileCount} archivos
                      </CardDescription>
                    </div>
                  </div>
                  <CardAction>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label={`Acciones de ${folder.name}`}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onSelect={() => setFolderId(folder.id)}
                          >
                            Abrir carpeta
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setRenameItem(folder)}
                          >
                            <FilePenLine />
                            Renombrar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              setMoveItem({ ...folder, isFolder: true })
                            }
                          >
                            <FolderInput />
                            Mover
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onSelect={() =>
                              setTrashItem({ ...folder, isFolder: true })
                            }
                            variant="destructive"
                          >
                            <Trash2 />
                            Enviar a papelera
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock aria-hidden="true" className="size-3.5" />
                    <span>Actualizada {folder.updatedAt}</span>
                  </div>
                  <span>{folder.size}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">Todos los archivos</p>
            {selectedAssetIds.length > 0 ? (
              <>
                <Badge variant="info">
                  {selectedAssetIds.length} seleccionados
                </Badge>
                <Button
                  onClick={() => setBulkTrashOpen(true)}
                  size="sm"
                  variant="destructive"
                >
                  <Trash2 data-icon="inline-start" />
                  Eliminar
                </Button>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              onValueChange={(value) => setAssetFilter(value as AssetFilter)}
              value={assetFilter}
            >
              <SelectTrigger aria-label="Filtrar archivos" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="image">Imágenes</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="document">Documentos</SelectItem>
                  <SelectItem value="ai">Creados con AI</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <ToggleGroup
              aria-label="Vista de archivos"
              onValueChange={(value) => {
                if (value) setView(value as FilesView)
              }}
              size="sm"
              spacing={0}
              type="single"
              value={view}
              variant="outline"
            >
              <ToggleGroupItem aria-label="Vista de cuadrícula" value="grid">
                <Grid2X2 />
              </ToggleGroupItem>
              <ToggleGroupItem aria-label="Vista de lista" value="list">
                <List />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {assets.length === 0 ? (
          <EmptyState
            action={
              hasFilters ? (
                <Button
                  onClick={() => {
                    setAssetFilter("all")
                    setFolderId("all")
                    setQuery("")
                  }}
                  variant="brand-secondary"
                >
                  Limpiar filtros
                </Button>
              ) : undefined
            }
            description={
              hasFilters
                ? "Prueba con otro término o restablece los filtros para consultar todos los archivos disponibles."
                : folderId === "all"
                  ? "Sube un archivo o crea una carpeta para comenzar a organizar tu biblioteca."
                  : "Crea una subcarpeta o sube un archivo para organizar este espacio."
            }
            icon={Search}
            title={
              hasFilters
                ? "No encontramos archivos"
                : folderId === "all"
                  ? "Aún no tienes archivos"
                  : "Esta carpeta está vacía"
            }
          />
        ) : view === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {assets.map((asset) => (
              <AssetCard
                asset={asset}
                key={asset.id}
                onSelect={toggleAsset}
                onToggleStar={toggleStar}
                onPreview={setPreviewAsset}
                onRename={setRenameItem}
                onMove={setMoveItem}
                onTrash={setTrashItem}
                selected={selectedAssetIds.includes(asset.id)}
              />
            ))}
          </div>
        ) : (
          <Card variant="subtle">
            <CardContent className="px-4">
              <AssetsTable
                assets={assets}
                onSelect={toggleAsset}
                onPreview={setPreviewAsset}
                onRename={setRenameItem}
                onMove={setMoveItem}
                onTrash={setTrashItem}
                selectedAssetIds={selectedAssetIds}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog onOpenChange={setUploadDialogOpen} open={uploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir archivos</DialogTitle>
            <DialogDescription>
              El archivo se guardará de forma privada en el almacenamiento local
              del servidor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <input
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadSelectedFile(file)
                event.currentTarget.value = ""
              }}
              ref={fileInputRef}
              type="file"
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              Seleccionar archivo
            </Button>
            <Button
              onClick={() => setUploadDialogOpen(false)}
              variant="brand-secondary"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={setFolderDialogOpen} open={folderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva carpeta</DialogTitle>
            <DialogDescription>
              Organiza los archivos de este espacio de trabajo.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Nombre de carpeta"
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="Nombre de carpeta"
            value={folderName}
          />
          <DialogFooter>
            <Button
              onClick={() => void createFolder()}
              disabled={!folderName.trim()}
            >
              Crear carpeta
            </Button>
            <Button
              onClick={() => setFolderDialogOpen(false)}
              variant="brand-secondary"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FilePreviewDialog
        item={previewAsset}
        onOpenChange={(open) => !open && setPreviewAsset(null)}
        open={Boolean(previewAsset)}
      />
      <FileRenameDialog
        item={renameItem}
        onConfirm={renameManagedItem}
        onOpenChange={(open) => !open && setRenameItem(null)}
        open={Boolean(renameItem)}
      />
      <FileMoveDialog
        folders={[...(library?.folders ?? [])]}
        item={moveItem}
        onConfirm={moveManagedItem}
        onOpenChange={(open) => !open && setMoveItem(null)}
        open={Boolean(moveItem)}
      />
      <FileTrashDialog
        item={trashItem}
        onConfirm={trashItem ? trashManagedItem : trashSelectedAssets}
        onOpenChange={(open) => {
          if (!open) {
            setTrashItem(null)
            setBulkTrashOpen(false)
          }
        }}
        open={Boolean(trashItem) || bulkTrashOpen}
        selectedCount={bulkTrashOpen ? selectedAssetIds.length : undefined}
      />
    </div>
  )
}
