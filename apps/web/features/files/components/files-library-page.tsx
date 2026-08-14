"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ApiError, filesApi } from "@workspace/api-client"
import type {
  GoogleDriveImportBatch,
  PortalGoogleDriveConfiguration,
} from "@workspace/contracts"
import { toast } from "@workspace/ui/components/toast"
import { CardGrid } from "@workspace/ui/components/card-grid"
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
  HardDriveDownload,
  Image,
  Info,
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
import { EmptyState } from "@workspace/ui/components/empty-state"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PageLoading } from "@workspace/ui/components/page-loading"
import {
  TABLE_EMPTY_ICON,
  TableEmptyRow,
} from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import {
  FilesErrorState,
  FilesPermissionState,
} from "@/features/files/components/files-states"
import {
  FileFolderDialog,
  FileInfoDialog,
  FileMoveDialog,
  FilePreviewDialog,
  FileRenameDialog,
  FileTrashDialog,
  FileUploadDialog,
} from "@/features/files/components/file-manager-dialogs"
import type {
  FileAsset,
  FileAssetKind,
  FileLibraryData,
} from "@/features/files/types/files"
import { openGoogleDrivePicker } from "@/features/files/components/google-drive-picker"

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
  >(
    asset.thumbnailStatus === "ready"
      ? "thumbnail"
      : asset.kind === "image"
        ? "preview"
        : "unavailable"
  )

  useEffect(() => {
    setImageSource(
      asset.thumbnailStatus === "ready"
        ? "thumbnail"
        : asset.kind === "image"
          ? "preview"
          : "unavailable"
    )
  }, [asset.id, asset.thumbnailStatus])

  if (
    (asset.kind !== "image" && asset.kind !== "video") ||
    imageSource === "unavailable"
  )
    return <AssetIcon aria-hidden="true" className={fallbackClassName} />

  return (
    <img
      alt=""
      className={imageClassName}
      onError={() =>
        setImageSource((current) =>
          current === "thumbnail" && asset.kind === "image"
            ? "preview"
            : "unavailable"
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
  onInfo,
  onRename,
  onMove,
  onTrash,
}: {
  asset: FileAsset
  selected: boolean
  onSelect: (id: string) => void
  onToggleStar: (asset: FileAsset) => void
  onPreview: (asset: FileAsset) => void
  onInfo: (asset: FileAsset) => void
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
            imageClassName="h-full w-full rounded-lg object-contain p-2"
          />
          <Checkbox
            aria-label={`Seleccionar ${asset.name}`}
            checked={selected}
            className="absolute top-2 left-2 border-2 border-foreground bg-background data-[state=checked]:border-primary"
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
        </div>
      </CardContent>
      <CardHeader>
        <CardTitle className="truncate">{asset.name}</CardTitle>
        <CardDescription className="truncate">
          Actualizado {asset.updatedAt} por {asset.owner}
        </CardDescription>
        <CardDescription className="truncate">
          {label} · {asset.size}
        </CardDescription>
        <CardAction>
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
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => onPreview(asset)}>
                  <Eye />
                  Vista previa
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onInfo(asset)}>
                  <Info />
                  Información
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
  onInfo,
  onRename,
  emptyProps,
  onMove,
  onTrash,
}: {
  assets: readonly FileAsset[]
  emptyProps: React.ComponentProps<typeof EmptyState>
  selectedAssetIds: readonly string[]
  onSelect: (id: string) => void
  onPreview: (asset: FileAsset) => void
  onInfo: (asset: FileAsset) => void
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
                    imageClassName="size-8 shrink-0 rounded object-contain p-0.5"
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
                    <DropdownMenuItem onSelect={() => onInfo(asset)}>
                      <Info />
                      Información
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
        {assets.length === 0 ? (
          <TableEmptyRow colSpan={5} {...emptyProps} />
        ) : null}
      </TableBody>
    </Table>
  )
}

function formatSize(sizeBytes: number) {
  return sizeBytes < 1024 * 1024
    ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
    : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

const FILES_PAGE_SIZE = 10

export function FilesLibraryPage() {
  const [library, setLibrary] = useState<FileLibraryData | null>(null)
  const [page, setPage] = useState(1)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState("")
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all")
  const [folderId, setFolderId] = useState<string | "all">("all")
  const [view, setView] = useState<FilesView>("grid")
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [bulkTrashOpen, setBulkTrashOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [driveProvider, setDriveProvider] =
    useState<PortalGoogleDriveConfiguration | null>(null)
  const [driveBatch, setDriveBatch] = useState<GoogleDriveImportBatch | null>(
    null
  )
  const [openingDrive, setOpeningDrive] = useState(false)
  const notifiedDriveBatch = useRef<string | null>(null)
  const [previewAsset, setPreviewAsset] = useState<FileAsset | null>(null)
  const [infoAsset, setInfoAsset] = useState<FileAsset | null>(null)
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
  function openFolder(nextFolderId: string | "all") {
    setPage(1)
    setFolderId(nextFolderId)
  }

  const loadLibrary = useCallback(async () => {
    setLoadError(false)
    try {
      const data = await filesApi.list({
        page,
        limit: FILES_PAGE_SIZE,
        folderId: folderId === "all" ? undefined : folderId,
        q: query.trim() || undefined,
        kind:
          assetFilter === "all" || assetFilter === "ai"
            ? undefined
            : assetFilter,
      })
      setLoadError(false)
      const next: FileLibraryData = {
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
        page: data.page,
        filesTotal: data.filesTotal,
      }
      setLibrary(next)
    } catch (error) {
      setLoadError(!(error instanceof ApiError && error.status === 403))
      setLibrary({
        canView: false,
        canUpload: false,
        folders: [],
        assets: [],
        page: 1,
        filesTotal: 0,
      })
    }
  }, [assetFilter, folderId, page, query])

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  useEffect(() => {
    void filesApi
      .googleDriveProvider()
      .then(setDriveProvider)
      .catch(() =>
        setDriveProvider({
          enabled: false,
          oauthClientId: null,
          browserApiKey: null,
          appId: null,
          configurationFingerprint: null,
        })
      )
  }, [])

  useEffect(() => {
    if (
      !driveBatch ||
      ["completed", "partial", "failed", "expired"].includes(driveBatch.status)
    ) {
      if (!driveBatch || notifiedDriveBatch.current === driveBatch.id) return
      notifiedDriveBatch.current = driveBatch.id
      void loadLibrary()
      if (driveBatch.status === "completed")
        toast.success("Importación desde Google Drive completada.")
      else if (driveBatch.status === "partial")
        toast.error("Algunos archivos de Google Drive no se pudieron importar.")
      else
        toast.error("No pudimos completar la importación desde Google Drive.")
      return
    }
    const timer = window.setTimeout(() => {
      void filesApi
        .googleDriveImport(driveBatch.id)
        .then(setDriveBatch)
        .catch(() => undefined)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [driveBatch, loadLibrary])

  async function importFromGoogleDrive() {
    setOpeningDrive(true)
    try {
      const currentProvider = await filesApi.googleDriveProvider()
      setDriveProvider(currentProvider)
      if (
        !currentProvider.enabled ||
        !currentProvider.oauthClientId ||
        !currentProvider.browserApiKey ||
        !currentProvider.appId
      ) {
        toast.error("Google Drive no está disponible en este momento.")
        return
      }
      const picked = await openGoogleDrivePicker({
        configuration: {
          oauthClientId: currentProvider.oauthClientId,
          browserApiKey: currentProvider.browserApiKey,
          appId: currentProvider.appId,
        },
        diagnostics: {
          pagePath: window.location.pathname,
          serverFingerprint: currentProvider.configurationFingerprint,
          sourceContext: "files",
        },
        multiselect: false,
      })
      if (!picked) return
      notifiedDriveBatch.current = null
      setDriveBatch(
        await filesApi.createGoogleDriveImport({
          ...picked,
          destinationFolderId: folderId === "all" ? null : folderId,
          idempotencyKey: crypto.randomUUID(),
          sourceContext: "files",
        })
      )
    } catch {
      toast.error("No pudimos abrir o iniciar la importación de Google Drive.")
    } finally {
      setOpeningDrive(false)
    }
  }

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
      if (folderId !== "all" && trashItem.id === folderId) openFolder("all")
      setTrashItem(null)
      await loadLibrary()
      toast.success("Elemento eliminado permanentemente")
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === "FILE_IN_USE_BY_PUBLISHING"
          ? "Este archivo se usa en Publishing y no puede eliminarse."
          : "No se pudo eliminar el elemento"
      )
    }
  }

  async function moveSelectedAssets(parentFolderId: string | null) {
    const ids = [...selectedAssetIds]
    if (!ids.length) return
    try {
      const results = await Promise.allSettled(
        ids.map((id) => filesApi.update(id, { folderId: parentFolderId }))
      )
      const failed = results.filter((result) => result.status === "rejected")
      setBulkMoveOpen(false)
      await loadLibrary()
      setSelectedAssetIds([])
      if (failed.length) {
        toast.error(
          failed.length === ids.length
            ? "No se pudo mover ningún archivo"
            : "Algunos archivos no se pudieron mover"
        )
        return
      }
      toast.success(ids.length === 1 ? "Archivo movido" : "Archivos movidos")
    } catch {
      toast.error("No se pudieron mover los archivos")
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
        ids.length === 1
          ? "Archivo eliminado permanentemente"
          : "Archivos eliminados permanentemente"
      )
    } catch {
      toast.error("No se pudieron eliminar los archivos")
    }
  }

  if (loadError)
    return (
      <FilesErrorState
        onRetry={() => void loadLibrary()}
        section="biblioteca"
      />
    )
  if (library === null) return <PageLoading />
  if (!library.canView) return <FilesPermissionState mode="library" />

  const assetsEmptyProps = {
    action: hasFilters ? (
      <Button
        onClick={() => {
          setAssetFilter("all")
          setQuery("")
          openFolder("all")
        }}
        variant="brand-secondary"
      >
        Limpiar filtros
      </Button>
    ) : undefined,
    description: hasFilters
      ? "Prueba con otro término o restablece los filtros para consultar todos los archivos disponibles."
      : folderId === "all"
        ? "Sube un archivo o crea una carpeta para comenzar a organizar tu biblioteca."
        : "Crea una subcarpeta o sube un archivo para organizar este espacio.",
    icon: TABLE_EMPTY_ICON,
    title: hasFilters
      ? "No encontramos archivos"
      : folderId === "all"
        ? "Aún no tienes archivos"
        : "Esta carpeta está vacía",
  }

  // The API applies the same page window to folders and files, so the range
  // is reported over the files, which is what both views actually list.
  const filesRangeStart = library.filesTotal
    ? (page - 1) * FILES_PAGE_SIZE + 1
    : 0
  const filesRangeEnd = Math.min(page * FILES_PAGE_SIZE, library.filesTotal)
  const filesPagination = (
    <TablePagination
      canGoNext={page * FILES_PAGE_SIZE < library.filesTotal}
      canGoPrevious={page > 1}
      itemLabel="archivos"
      onNextPage={() => setPage((current) => current + 1)}
      onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
      rangeEnd={filesRangeEnd}
      rangeStart={filesRangeStart}
      total={library.filesTotal}
    />
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <InputGroup className="max-w-xl">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Buscar archivos y carpetas"
            onChange={(event) => {
              setPage(1)
              setQuery(event.target.value)
            }}
            placeholder="Buscar archivos y carpetas"
            value={query}
          />
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!library.canUpload}
            onClick={() => setFolderDialogOpen(true)}
            variant="brand-secondary"
          >
            <FolderPlus data-icon="inline-start" />
            Nueva carpeta
          </Button>
          {driveProvider?.enabled ? (
            <Button
              disabled={!library.canUpload || openingDrive}
              onClick={() => void importFromGoogleDrive()}
              variant="brand-secondary"
            >
              {openingDrive ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HardDriveDownload data-icon="inline-start" />
              )}
              {openingDrive ? "Abriendo Google" : "Google Drive"}
            </Button>
          ) : null}
          <Button
            className="hidden sm:inline-flex"
            disabled={!library.canUpload}
            onClick={() => setUploadDialogOpen(true)}
          >
            <Upload data-icon="inline-start" />
            Subir archivos
          </Button>
        </div>
      </div>

      {driveBatch ? (
        <Card variant="subtle">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">
                {driveBatch.status === "completed"
                  ? "Importación desde Google Drive completada"
                  : driveBatch.status === "failed" ||
                      driveBatch.status === "expired"
                    ? "Importación desde Google Drive fallida"
                    : "Importando desde Google Drive"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {driveBatch.completedItems} de {driveBatch.totalItems} archivos
                importados
                {driveBatch.destinationFolderId
                  ? " en la carpeta de destino."
                  : " en Archivos."}
              </p>
            </div>
            <Badge
              variant={
                driveBatch.status === "completed"
                  ? "success"
                  : driveBatch.status === "failed" ||
                      driveBatch.status === "expired"
                    ? "destructive"
                    : driveBatch.status === "partial"
                      ? "warning"
                      : "info"
              }
            >
              {driveBatch.status === "completed"
                ? "Completada"
                : driveBatch.status === "partial"
                  ? "Parcial"
                  : driveBatch.status === "failed" ||
                      driveBatch.status === "expired"
                    ? "Fallida"
                    : "Procesando"}
            </Badge>
          </CardContent>
        </Card>
      ) : null}

      {currentFolderPath.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button onClick={() => openFolder("all")} type="button">
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
                    <button onClick={() => openFolder(folder.id)} type="button">
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
          <CardGrid>
            {visibleFolders.map((folder) => (
              <Card
                className="cursor-pointer transition-colors hover:bg-accent/50"
                key={folder.id}
                onClick={(event) => {
                  if (event.currentTarget.contains(event.target as Node))
                    openFolder(folder.id)
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    openFolder(folder.id)
                  }
                }}
                role="link"
                tabIndex={0}
                size="sm"
              >
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
                          onClick={(event) => event.stopPropagation()}
                          size="icon-sm"
                          variant="brand-secondary"
                        >
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
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
          </CardGrid>
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
                  className="leading-none"
                  onClick={() => setBulkMoveOpen(true)}
                  size="sm"
                  variant="brand-secondary"
                >
                  <FolderInput data-icon="inline-start" />
                  Mover
                </Button>
                <Button
                  className="leading-none"
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
              onValueChange={(value) => {
                setPage(1)
                setAssetFilter(value as AssetFilter)
              }}
              value={assetFilter}
            >
              <SelectTrigger
                aria-label="Filtrar archivos"
                className="w-max max-w-full"
              >
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

        {view === "grid" ? (
          <>
            {assets.length === 0 ? <EmptyState {...assetsEmptyProps} /> : null}
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {assets.map((asset) => (
                <AssetCard
                  asset={asset}
                  key={asset.id}
                  onSelect={toggleAsset}
                  onToggleStar={toggleStar}
                  onPreview={setPreviewAsset}
                  onInfo={setInfoAsset}
                  onRename={setRenameItem}
                  onMove={setMoveItem}
                  onTrash={setTrashItem}
                  selected={selectedAssetIds.includes(asset.id)}
                />
              ))}
            </div>
            {filesPagination}
          </>
        ) : (
          <Card variant="subtle">
            <CardContent className="flex flex-col gap-4 px-0">
              <AssetsTable
                assets={assets}
                emptyProps={assetsEmptyProps}
                onSelect={toggleAsset}
                onPreview={setPreviewAsset}
                onInfo={setInfoAsset}
                onRename={setRenameItem}
                onMove={setMoveItem}
                onTrash={setTrashItem}
                selectedAssetIds={selectedAssetIds}
              />
              {filesPagination}
            </CardContent>
          </Card>
        )}
      </div>

      <FloatingActionButton
        disabled={!library.canUpload}
        icon={<Upload aria-hidden="true" className="size-6" />}
        label="Subir archivos"
        onClick={() => setUploadDialogOpen(true)}
      />

      <FileUploadDialog
        onOpenChange={setUploadDialogOpen}
        onSelect={(file) => void uploadSelectedFile(file)}
        open={uploadDialogOpen}
      />
      <FileFolderDialog
        name={folderName}
        onConfirm={() => void createFolder()}
        onNameChange={setFolderName}
        onOpenChange={setFolderDialogOpen}
        open={folderDialogOpen}
      />
      <FilePreviewDialog
        item={previewAsset}
        onOpenChange={(open) => !open && setPreviewAsset(null)}
        open={Boolean(previewAsset)}
      />
      <FileInfoDialog
        item={infoAsset}
        onOpenChange={(open) => !open && setInfoAsset(null)}
        open={Boolean(infoAsset)}
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
        onConfirm={moveItem ? moveManagedItem : moveSelectedAssets}
        onOpenChange={(open) => {
          if (!open) {
            setMoveItem(null)
            setBulkMoveOpen(false)
          }
        }}
        open={Boolean(moveItem) || bulkMoveOpen}
        selectedCount={bulkMoveOpen ? selectedAssetIds.length : undefined}
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
