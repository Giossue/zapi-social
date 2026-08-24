"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ApiError, filesApi } from "@workspace/api-client"
import type {
  GoogleDriveImportBatch,
  PortalFileSort,
  PortalFileSortOrder,
  PortalFilesResponse,
  PortalGoogleDriveConfiguration,
} from "@workspace/contracts"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  FilePenLine,
  FileText,
  Folder,
  FolderPlus,
  FolderInput,
  Grid2X2,
  HardDrive,
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
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { DataTableFilter } from "@workspace/ui/components/data-table-controls"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PageLoading } from "@/components/page-loading"
import {
  TABLE_EMPTY_ICON,
  TableEmptyRow,
} from "@workspace/ui/components/table-empty-row"
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
  FileFolder,
  FileLibraryData,
} from "@/features/files/types/files"
import { openGoogleDrivePicker } from "@/features/files/components/google-drive-picker"
import { useLibrarySelection } from "@/features/files/hooks/use-library-selection"

type FilesView = "grid" | "list"

const DRIVE_IMPORT_WAIT_MS = 120_000

type AssetFilter = FileAssetKind | "all" | "folder"

const assetKindMeta: Record<FileAssetKind, { icon: typeof Image }> = {
  document: { icon: FileText },
  image: { icon: Image },
  video: { icon: Video },
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
  const matchesFilter = filter === "all" || asset.kind === filter
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

  const sourceKey = `${asset.id}:${asset.kind}:${asset.thumbnailStatus}`
  const [lastSourceKey, setLastSourceKey] = useState(sourceKey)

  if (sourceKey !== lastSourceKey) {
    setLastSourceKey(sourceKey)
    setImageSource(
      asset.thumbnailStatus === "ready"
        ? "thumbnail"
        : asset.kind === "image"
          ? "preview"
          : "unavailable"
    )
  }

  if (
    (asset.kind !== "image" && asset.kind !== "video") ||
    imageSource === "unavailable"
  )
    return <AssetIcon aria-hidden="true" className={fallbackClassName} />

  return (
    // eslint-disable-next-line @next/next/no-img-element -- la miniatura la sirve la API de Files, fuera del optimizador de Next.
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

type LibraryItemProps = ReturnType<
  ReturnType<typeof useLibrarySelection<LibraryEntry>>["getItemProps"]
>

type LibraryEntry =
  | { asset: FileAsset; id: string; type: "file" }
  | { folder: FileFolder; id: string; type: "folder" }

function rowSelection({
  "data-selected": selected,
  role: _role,
  ...props
}: LibraryItemProps) {
  return {
    ...props,
    "data-selected": selected,
    "data-state": selected ? ("selected" as const) : undefined,
  }
}

function AssetCard({
  asset,
  itemProps,
  onToggleStar,
  onPreview,
  onInfo,
  onRename,
  onMove,
  onTrash,
}: {
  asset: FileAsset
  itemProps: LibraryItemProps
  onToggleStar: (asset: FileAsset) => void
  onPreview: (asset: FileAsset) => void
  onInfo: (asset: FileAsset) => void
  onRename: (asset: FileAsset) => void
  onMove: (asset: FileAsset) => void
  onTrash: (asset: FileAsset) => void
}) {
  const t = useTranslations("files")
  const label = t(`kind.${asset.kind}`)

  return (
    <Card
      className="group/file cursor-default select-none"
      size="sm"
      {...itemProps}
    >
      <CardContent>
        <div className="relative flex h-36 items-center justify-center rounded-lg bg-muted/50">
          <AssetThumbnail
            asset={asset}
            fallbackClassName="size-12 text-muted-foreground"
            imageClassName="h-full w-full rounded-lg object-contain p-2"
          />
          <Button
            aria-label={
              asset.starred
                ? t("unstar", { name: asset.name })
                : t("star", { name: asset.name })
            }
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
          {t("updatedByOwner", {
            date: asset.updatedAt,
            owner: asset.owner,
          })}
        </CardDescription>
        <CardDescription className="truncate">
          {label} · {asset.size}
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t("itemActions", { name: asset.name })}
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
                  {t("preview")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onInfo(asset)}>
                  <Info />
                  {t("infoAction")}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={filesApi.downloadUrl(asset.id)}>
                    <Download />
                    {t("download")}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onRename(asset)}>
                  <FilePenLine />
                  {t("renameTitle")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(asset)}>
                  <FolderInput />
                  {t("move")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={() => onTrash(asset)}
                  variant="destructive"
                >
                  <Trash2 />
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
    </Card>
  )
}

function FolderCard({
  folder,
  itemProps,
  onMove,
  onRename,
  onTrash,
}: {
  folder: FileFolder
  itemProps: LibraryItemProps
  onMove: (folder: FileFolder) => void
  onRename: (folder: FileFolder) => void
  onTrash: (folder: FileFolder) => void
}) {
  const t = useTranslations("files")

  return (
    <Card
      className="cursor-default transition-colors select-none hover:bg-accent/50"
      size="sm"
      {...itemProps}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Folder
            aria-hidden="true"
            className="size-4.5 shrink-0 fill-current text-muted-foreground"
          />
          <CardTitle className="truncate leading-none">{folder.name}</CardTitle>
        </div>
        <CardAction className="col-auto row-auto shrink-0 self-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t("itemActions", { name: folder.name })}
                onClick={(event) => event.stopPropagation()}
                size="icon-sm"
                variant="brand-secondary"
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => onRename(folder)}>
                  <FilePenLine />
                  {t("renameTitle")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(folder)}>
                  <FolderInput />
                  {t("move")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={() => onTrash(folder)}
                  variant="destructive"
                >
                  <Trash2 />
                  {t("delete")}
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
  folders,
  itemPropsOf,
  onOpenFolder,
  onPreview,
  onInfo,
  onRename,
  onRenameFolder,
  emptyProps,
  onMove,
  onMoveFolder,
  onTrash,
  onTrashFolder,
}: {
  assets: readonly FileAsset[]
  emptyProps: React.ComponentProps<typeof EmptyState>
  folders: readonly FileFolder[]
  itemPropsOf: (id: string) => LibraryItemProps
  onOpenFolder: (id: string) => void
  onPreview: (asset: FileAsset) => void
  onInfo: (asset: FileAsset) => void
  onRename: (asset: FileAsset) => void
  onRenameFolder: (folder: FileFolder) => void
  onMove: (asset: FileAsset) => void
  onMoveFolder: (folder: FileFolder) => void
  onTrash: (asset: FileAsset) => void
  onTrashFolder: (folder: FileFolder) => void
}) {
  const t = useTranslations("files")
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("name")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("type")}</TableHead>
          <TableHead className="hidden lg:table-cell">{t("updated")}</TableHead>
          <TableHead className="text-right">{t("actionColumn")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {folders.map((folder) => (
          <TableRow key={folder.id} {...rowSelection(itemPropsOf(folder.id))}>
            <TableCell>
              <div className="flex min-w-0 items-center gap-3">
                <Folder
                  aria-hidden="true"
                  className="size-5 shrink-0 fill-current text-muted-foreground"
                />
                <div className="min-w-0">
                  <Button
                    className="h-auto max-w-72 justify-start px-0 font-medium"
                    onClick={() => onOpenFolder(folder.id)}
                    size="sm"
                    variant="link"
                  >
                    <span className="truncate">{folder.name}</span>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t("folderSummary", {
                      count: folder.fileCount,
                      size: folder.size,
                    })}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {t("folder")}
            </TableCell>
            <TableCell className="hidden text-muted-foreground lg:table-cell">
              {folder.updatedAt}
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={t("itemActions", { name: folder.name })}
                    size="icon-sm"
                    variant="brand-secondary"
                  >
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onRenameFolder(folder)}>
                    <FilePenLine />
                    {t("renameTitle")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onMoveFolder(folder)}>
                    <FolderInput />
                    {t("move")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onTrashFolder(folder)}
                    variant="destructive"
                  >
                    <Trash2 />
                    {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
        {assets.map((asset) => {
          const label = t(`kind.${asset.kind}`)

          return (
            <TableRow key={asset.id} {...rowSelection(itemPropsOf(asset.id))}>
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
                      aria-label={t("itemActions", { name: asset.name })}
                      size="icon-sm"
                      variant="brand-secondary"
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onPreview(asset)}>
                      <Eye />
                      {t("preview")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onInfo(asset)}>
                      <Info />
                      {t("infoAction")}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={filesApi.downloadUrl(asset.id)}>
                        <Download />
                        {t("download")}
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onRename(asset)}>
                      <FilePenLine />
                      {t("renameTitle")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(asset)}>
                      <FolderInput />
                      {t("move")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onTrash(asset)}
                      variant="destructive"
                    >
                      <Trash2 />
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
        {assets.length === 0 && folders.length === 0 ? (
          <TableEmptyRow colSpan={4} {...emptyProps} />
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

function toFolder(
  folder: PortalFilesResponse["folders"][number],
  formatDate: (value: string) => string
): FileFolder {
  return {
    ...folder,
    size: formatSize(folder.sizeBytes),
    updatedAt: formatDate(folder.updatedAt),
  }
}

function toAsset(
  asset: PortalFilesResponse["files"][number],
  formatDate: (value: string) => string
): FileAsset {
  return {
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
    updatedAt: formatDate(asset.modifiedAt),
    shared: false,
    generatedWithAi: false,
    starred: asset.starred,
    thumbnailStatus: asset.thumbnailStatus,
  }
}

const FILES_PAGE_SIZE = 24
const FILES_MAX_LIMIT = 100

export function FilesLibraryPage() {
  const t = useTranslations("files")
  const format = useFormatter()
  const formatDate = useCallback(
    (value: string) =>
      format.dateTime(new Date(value), { dateStyle: "medium" }),
    [format]
  )
  const [library, setLibrary] = useState<FileLibraryData | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState("")
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all")
  const [sort, setSort] = useState<PortalFileSort>("modifiedAt")
  const [order, setOrder] = useState<PortalFileSortOrder>("desc")
  const [folderId, setFolderId] = useState<string | "all">("all")
  const [view, setView] = useState<FilesView>("grid")
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [bulkTrashOpen, setBulkTrashOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [driveProvider, setDriveProvider] =
    useState<PortalGoogleDriveConfiguration | null>(null)
  const [driveBatch, setDriveBatch] = useState<GoogleDriveImportBatch | null>(
    null
  )
  const [openingDrive, setOpeningDrive] = useState(false)
  const notifiedDriveBatch = useRef<string | null>(null)
  const driveBatchStartedAt = useRef(0)
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
  const [trashBlockedByPublishing, setTrashBlockedByPublishing] =
    useState(false)
  const [trashPending, setTrashPending] = useState(false)
  const loadedPages = useRef(1)
  const sentinel = useRef<HTMLDivElement>(null)

  function openFolder(nextFolderId: string | "all") {
    setFolderId(nextFolderId)
  }

  const fetchFiles = useCallback(
    (pageToLoad: number, limit: number) =>
      filesApi.list({
        page: pageToLoad,
        limit,
        folderId: folderId === "all" ? undefined : folderId,
        order,
        q: query.trim() || undefined,
        sort,
        kind:
          assetFilter === "all" || assetFilter === "folder"
            ? undefined
            : assetFilter,
      }),
    [assetFilter, folderId, order, query, sort]
  )

  const loadLibrary = useCallback(async () => {
    setLoadError(false)
    const limit = Math.min(
      FILES_MAX_LIMIT,
      FILES_PAGE_SIZE * loadedPages.current
    )
    try {
      const data = await fetchFiles(1, limit)
      setLoadError(false)
      loadedPages.current = Math.ceil(limit / FILES_PAGE_SIZE)
      setReachedEnd(data.files.length < limit)
      const next: FileLibraryData = {
        canView: true,
        canUpload: data.canManage,
        folderPath: data.folderPath,
        folders: data.folders.map((folder) => toFolder(folder, formatDate)),
        assets: data.files.map((asset) => toAsset(asset, formatDate)),
        page: data.page,
        filesTotal: data.filesTotal,
      }
      setLibrary(next)
    } catch (error) {
      setLoadError(!(error instanceof ApiError && error.status === 403))
      setLibrary({
        canView: false,
        canUpload: false,
        folderPath: [],
        folders: [],
        assets: [],
        page: 1,
        filesTotal: 0,
      })
    }
  }, [fetchFiles, formatDate])

  const loadMoreFiles = useCallback(async () => {
    setLoadingMore(true)
    try {
      const nextPage = loadedPages.current + 1
      const data = await fetchFiles(nextPage, FILES_PAGE_SIZE)
      loadedPages.current = nextPage
      setReachedEnd(data.files.length < FILES_PAGE_SIZE)
      setLibrary((current) =>
        current
          ? {
              ...current,
              assets: [
                ...current.assets,
                ...data.files.map((asset) => toAsset(asset, formatDate)),
              ],
              page: data.page,
              filesTotal: data.filesTotal,
            }
          : current
      )
    } catch {
      toast.error(t("loadMoreFailed"))
    } finally {
      setLoadingMore(false)
    }
  }, [fetchFiles, formatDate, t])

  useEffect(() => {
    loadedPages.current = 1
    const timer = setTimeout(() => void loadLibrary(), 0)
    return () => clearTimeout(timer)
  }, [loadLibrary])

  const hasMoreFiles = Boolean(
    library &&
    !reachedEnd &&
    assetFilter !== "folder" &&
    library.assets.length < library.filesTotal
  )

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasMoreFiles || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMoreFiles()
      },
      { rootMargin: "300px" }
    )
    observer.observe(node)

    return () => observer.disconnect()
  }, [hasMoreFiles, loadMoreFiles, loadingMore])

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
    if (!driveBatch) return

    const toastId = `google-drive-import-${driveBatch.id}`

    if (
      ["completed", "partial", "failed", "expired"].includes(driveBatch.status)
    ) {
      if (notifiedDriveBatch.current === driveBatch.id) return
      notifiedDriveBatch.current = driveBatch.id
      void loadLibrary()
      if (driveBatch.status === "completed")
        toast.success(t("driveImportDone"), {
          id: toastId,
        })
      else if (driveBatch.status === "partial")
        toast.error(t("driveImportPartial"), {
          id: toastId,
        })
      else
        toast.error(t("driveImportFailed"), {
          id: toastId,
        })
      return
    }

    toast.loading(t("driveImporting", { count: driveBatch.totalItems }), {
      description: t("driveProgress", {
        done: driveBatch.completedItems,
        total: driveBatch.totalItems,
      }),
      duration: Number.POSITIVE_INFINITY,
      id: toastId,
    })

    if (Date.now() - driveBatchStartedAt.current > DRIVE_IMPORT_WAIT_MS) {
      notifiedDriveBatch.current = driveBatch.id
      toast.info(t("driveImportRunning"), {
        id: toastId,
      })
      return
    }

    const timer = window.setTimeout(() => {
      void filesApi
        .googleDriveImport(driveBatch.id)
        .then(setDriveBatch)
        .catch(() => undefined)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [driveBatch, loadLibrary, t])

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
        toast.error(t("driveUnavailable"))
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
      driveBatchStartedAt.current = Date.now()
      setDriveBatch(
        await filesApi.createGoogleDriveImport({
          ...picked,
          destinationFolderId: folderId === "all" ? null : folderId,
          idempotencyKey: crypto.randomUUID(),
          sourceContext: "files",
        })
      )
    } catch {
      toast.error(t("driveOpenFailed"))
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
      toast.success(t("uploaded"))
    } catch {
      toast.error(t("uploadFailed"))
    }
  }

  async function createFolder() {
    const name = folderName.trim()
    if (!name || creatingFolder) return

    setCreatingFolder(true)
    try {
      await filesApi.createFolder({
        name,
        parentFolderId: folderId === "all" ? null : folderId,
      })
      setFolderName("")
      setFolderDialogOpen(false)
      await loadLibrary()
      toast.success(t("folderCreated"))
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === "VALIDATION_FAILED"
          ? t("folderNameTaken")
          : t("folderCreateFailed")
      )
    } finally {
      setCreatingFolder(false)
    }
  }

  const assets = useMemo(
    () =>
      assetFilter === "folder"
        ? []
        : (library?.assets ?? []).filter((asset) =>
            assetMatches(asset, query, assetFilter, folderId)
          ),
    [assetFilter, folderId, library?.assets, query]
  )
  const currentFolderPath = library?.folderPath ?? []
  const visibleFolders = useMemo(
    () =>
      assetFilter !== "all" && assetFilter !== "folder"
        ? []
        : (library?.folders ?? []).filter(
            (folder) =>
              folder.parentFolderId === (folderId === "all" ? null : folderId)
          ),
    [assetFilter, folderId, library?.folders]
  )
  const hasFilters = Boolean(query.trim()) || assetFilter !== "all"

  const entries = useMemo<LibraryEntry[]>(
    () => [
      ...visibleFolders.map((folder) => ({
        folder,
        id: folder.id,
        type: "folder" as const,
      })),
      ...assets.map((asset) => ({
        asset,
        id: asset.id,
        type: "file" as const,
      })),
    ],
    [assets, visibleFolders]
  )

  const { containerProps, getItemProps, selection, clearSelection } =
    useLibrarySelection<LibraryEntry>({
      items: entries,
      onOpen: (entry) => {
        if (entry.type === "folder") openFolder(entry.folder.id)
        else setPreviewAsset(entry.asset)
      },
    })

  const itemPropsOf = (id: string) => {
    const entry = entries.find((item) => item.id === id)

    return getItemProps(entry as LibraryEntry)
  }

  const selectedAssetIds = useMemo(
    () => selection.filter((id) => assets.some((asset) => asset.id === id)),
    [assets, selection]
  )
  const selectedFolderIds = useMemo(
    () => selection.filter((id) => visibleFolders.some((f) => f.id === id)),
    [selection, visibleFolders]
  )

  async function toggleStar(asset: FileAsset) {
    try {
      await filesApi.update(asset.id, { starred: !asset.starred })
      await loadLibrary()
      toast.success(asset.starred ? t("unstarred") : t("starred"))
    } catch {
      toast.error(t("starFailed"))
    }
  }

  async function renameManagedItem(name: string) {
    if (!renameItem) return
    try {
      if ("kind" in renameItem) await filesApi.update(renameItem.id, { name })
      else await filesApi.updateFolder(renameItem.id, { name })
      setRenameItem(null)
      await loadLibrary()
      toast.success(t("renamed"))
    } catch {
      toast.error(t("renameFailed"))
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
      toast.success(t("moved"))
    } catch {
      toast.error(t("moveFailed"))
    }
  }

  async function trashManagedItem() {
    if (!trashItem) return
    setTrashPending(true)
    try {
      if (trashItem.isFolder) await filesApi.removeFolder(trashItem.id)
      else await filesApi.remove(trashItem.id)
      if (folderId !== "all" && trashItem.id === folderId) openFolder("all")
      setTrashBlockedByPublishing(false)
      setTrashItem(null)
      await loadLibrary()
      toast.success(t("deleted"))
    } catch (error) {
      const blockedByPublishing =
        error instanceof ApiError && error.code === "FILE_IN_USE_BY_PUBLISHING"
      setTrashBlockedByPublishing(blockedByPublishing)
      toast.error(
        blockedByPublishing ? t("inUseByPublishingTitle") : t("deleteFailed")
      )
    } finally {
      setTrashPending(false)
    }
  }

  async function moveSelection(parentFolderId: string | null) {
    const total = selectedAssetIds.length + selectedFolderIds.length
    if (!total) return

    try {
      const results = await Promise.allSettled([
        ...selectedAssetIds.map((id) =>
          filesApi.update(id, { folderId: parentFolderId })
        ),
        ...selectedFolderIds.map((id) =>
          filesApi.updateFolder(id, { parentFolderId })
        ),
      ])
      const failed = results.filter((result) => result.status === "rejected")
      setBulkMoveOpen(false)
      await loadLibrary()
      clearSelection()
      if (failed.length) {
        toast.error(
          failed.length === total ? t("moveNoneFailed") : t("moveSomeFailed")
        )
        return
      }
      toast.success(t("movedCount", { count: total }))
    } catch {
      toast.error(t("moveManyFailed"))
    }
  }

  async function trashSelection() {
    const total = selectedAssetIds.length + selectedFolderIds.length
    if (!total) return

    setTrashPending(true)
    try {
      const results = await Promise.allSettled([
        ...selectedAssetIds.map((id) => filesApi.remove(id)),
        ...selectedFolderIds.map((id) => filesApi.removeFolder(id)),
      ])
      const failed = results.filter((result) => result.status === "rejected")
      await loadLibrary()
      if (failed.length) {
        const blockedByPublishing = failed.some(
          (result) =>
            result.status === "rejected" &&
            result.reason instanceof ApiError &&
            result.reason.code === "FILE_IN_USE_BY_PUBLISHING"
        )
        if (blockedByPublishing) {
          setTrashBlockedByPublishing(true)
          toast.error(t("inUseByPublishingTitle"))
          return
        }
        setBulkTrashOpen(false)
        clearSelection()
        toast.error(
          failed.length === total
            ? t("deleteNoneFailed")
            : t("deleteSomeFailed")
        )
        return
      }
      setBulkTrashOpen(false)
      setTrashBlockedByPublishing(false)
      clearSelection()
      toast.success(total === 1 ? t("deleted") : t("deletedMany"))
    } catch {
      toast.error(t("deleteManyFailed"))
    } finally {
      setTrashPending(false)
    }
  }

  if (loadError)
    return (
      <FilesErrorState onRetry={() => void loadLibrary()} section="library" />
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
        {t("clearFilters")}
      </Button>
    ) : undefined,
    description: hasFilters
      ? t("emptyFilteredDescription")
      : folderId === "all"
        ? t("emptyRootDescription")
        : t("emptyFolderDescription"),
    icon: TABLE_EMPTY_ICON,
    title: hasFilters
      ? t("noMatches")
      : folderId === "all"
        ? t("emptyRootTitle")
        : t("emptyFolderTitle"),
  }

  const trail = [
    { id: "all", name: t("rootFolder") },
    ...currentFolderPath.map((folder) => ({
      id: folder.id,
      name: folder.name,
    })),
  ]
  const collapsedTrail = trail.length > 3 ? trail.slice(0, -2) : []
  const visibleTrail =
    collapsedTrail.length > 0 ? trail.slice(-2) : trail.slice(1)

  const filesLoader = hasMoreFiles ? (
    <div className="flex justify-center py-4" ref={sentinel}>
      <Spinner aria-label={t("loadingMore")} />
    </div>
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <InputGroup className="max-w-xl">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t("searchLabel")}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchLabel")}
            value={query}
          />
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="hidden sm:inline-flex"
            disabled={!library.canUpload}
            onClick={() => setFolderDialogOpen(true)}
            variant="brand-secondary"
          >
            <FolderPlus data-icon="inline-start" />
            {t("newFolderTitle")}
          </Button>
          {driveProvider?.enabled ? (
            <Button
              className="hidden sm:inline-flex"
              disabled={!library.canUpload || openingDrive}
              onClick={() => void importFromGoogleDrive()}
              variant="brand-secondary"
            >
              {openingDrive ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HardDriveDownload data-icon="inline-start" />
              )}
              {openingDrive ? t("openingDrive") : "Google Drive"}
            </Button>
          ) : null}
          <Button
            className="hidden sm:inline-flex"
            disabled={!library.canUpload}
            onClick={() => setUploadDialogOpen(true)}
          >
            <Upload data-icon="inline-start" />
            {t("uploadTitle")}
          </Button>
        </div>
      </div>

      {currentFolderPath.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {collapsedTrail.length > 0 ? (
              <>
                <BreadcrumbItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={t("previousFolders")}
                      className="flex size-5 items-center justify-center rounded-sm hover:text-foreground focus-visible:outline-3 focus-visible:outline-ring/50"
                    >
                      <BreadcrumbEllipsis />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {collapsedTrail.map((step) => (
                        <DropdownMenuItem
                          key={step.id}
                          onSelect={() => openFolder(step.id)}
                        >
                          {step.id === "all" ? (
                            <HardDrive aria-hidden="true" />
                          ) : (
                            <Folder
                              aria-hidden="true"
                              className="fill-current"
                            />
                          )}
                          {step.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <button onClick={() => openFolder("all")} type="button">
                    {t("rootFolder")}
                  </button>
                </BreadcrumbLink>
              </BreadcrumbItem>
            )}
            {visibleTrail.map((step, index) => (
              <BreadcrumbItem key={step.id}>
                <BreadcrumbSeparator />
                {index === visibleTrail.length - 1 ? (
                  <BreadcrumbPage>{step.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <button onClick={() => openFolder(step.id)} type="button">
                      {step.name}
                    </button>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <DataTableFilter
              ariaLabel={t("filterType")}
              label={t("type")}
              onValueChange={(value) => setAssetFilter(value as AssetFilter)}
              options={[
                { label: t("all"), value: "all" },
                { label: t("filter.image"), value: "image" },
                { label: t("filter.video"), value: "video" },
                { label: t("filter.document"), value: "document" },
                { label: t("filter.folder"), value: "folder" },
              ]}
              value={assetFilter}
            />
            {selection.length > 0 ? (
              <>
                <Badge variant="info">
                  {selection.length}{" "}
                  {selection.length === 1 ? "seleccionado" : "seleccionados"}
                </Badge>
                <Button
                  className="leading-none"
                  onClick={() => setBulkMoveOpen(true)}
                  size="sm"
                  variant="brand-secondary"
                >
                  <FolderInput data-icon="inline-start" />
                  {t("move")}
                </Button>
                <Button
                  className="leading-none"
                  onClick={() => setBulkTrashOpen(true)}
                  size="sm"
                  variant="destructive"
                >
                  <Trash2 data-icon="inline-start" />
                  {t("delete")}
                </Button>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  {t(`sort.${sort}`)}
                  {order === "desc" ? <ArrowDown /> : <ArrowUp />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("sortBy")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  onValueChange={(value) => setSort(value as PortalFileSort)}
                  value={sort}
                >
                  <DropdownMenuRadioItem value="name">
                    {t("name")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="modifiedAt">
                    {t("modifiedColumn")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t("order")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  onValueChange={(value) =>
                    setOrder(value as PortalFileSortOrder)
                  }
                  value={order}
                >
                  <DropdownMenuRadioItem value="desc">
                    {sort === "name" ? t("sortZA") : t("sortNewest")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="asc">
                    {sort === "name" ? t("sortAZ") : t("sortOldest")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <ToggleGroup
              aria-label={t("viewLabel")}
              onValueChange={(value) => {
                if (value) setView(value as FilesView)
              }}
              size="sm"
              spacing={0}
              type="single"
              value={view}
              variant="outline"
            >
              <ToggleGroupItem aria-label={t("gridView")} value="grid">
                <Grid2X2 />
              </ToggleGroupItem>
              <ToggleGroupItem aria-label={t("listView")} value="list">
                <List />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {view === "grid" ? (
          <div
            aria-multiselectable="true"
            className="flex flex-col gap-3"
            role="listbox"
            {...containerProps}
          >
            {assets.length === 0 && visibleFolders.length === 0 ? (
              <EmptyState {...assetsEmptyProps} />
            ) : null}
            {visibleFolders.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {visibleFolders.map((folder) => (
                  <FolderCard
                    folder={folder}
                    itemProps={itemPropsOf(folder.id)}
                    key={folder.id}
                    onMove={(item) => setMoveItem({ ...item, isFolder: true })}
                    onRename={setRenameItem}
                    onTrash={(item) =>
                      setTrashItem({ ...item, isFolder: true })
                    }
                  />
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {assets.map((asset) => (
                <AssetCard
                  asset={asset}
                  itemProps={itemPropsOf(asset.id)}
                  key={asset.id}
                  onToggleStar={toggleStar}
                  onPreview={setPreviewAsset}
                  onInfo={setInfoAsset}
                  onRename={setRenameItem}
                  onMove={setMoveItem}
                  onTrash={setTrashItem}
                />
              ))}
            </div>
            {filesLoader}
          </div>
        ) : (
          <Card variant="subtle">
            <CardContent className="flex flex-col gap-4 px-0">
              <div {...containerProps}>
                <AssetsTable
                  assets={assets}
                  emptyProps={assetsEmptyProps}
                  folders={visibleFolders}
                  itemPropsOf={itemPropsOf}
                  onInfo={setInfoAsset}
                  onMove={setMoveItem}
                  onMoveFolder={(folder) =>
                    setMoveItem({ ...folder, isFolder: true })
                  }
                  onOpenFolder={openFolder}
                  onPreview={setPreviewAsset}
                  onRename={setRenameItem}
                  onRenameFolder={setRenameItem}
                  onTrash={setTrashItem}
                  onTrashFolder={(folder) =>
                    setTrashItem({ ...folder, isFolder: true })
                  }
                />
              </div>
              {filesLoader}
            </CardContent>
          </Card>
        )}
      </div>

      <FloatingActionButton
        disabled={!library.canUpload}
        label={t("addToLibrary")}
        menu={
          <DropdownMenuContent align="end" className="w-56" side="top">
            <DropdownMenuItem onSelect={() => setFolderDialogOpen(true)}>
              <FolderPlus aria-hidden="true" />
              {t("newFolderTitle")}
            </DropdownMenuItem>
            {driveProvider?.enabled ? (
              <DropdownMenuItem
                disabled={openingDrive}
                onSelect={() => void importFromGoogleDrive()}
              >
                <HardDriveDownload aria-hidden="true" />
                Google Drive
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => setUploadDialogOpen(true)}>
              <Upload aria-hidden="true" />
              {t("uploadFromDevice")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        }
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
        pending={creatingFolder}
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
        onConfirm={moveItem ? moveManagedItem : moveSelection}
        onOpenChange={(open) => {
          if (!open) {
            setMoveItem(null)
            setBulkMoveOpen(false)
          }
        }}
        open={Boolean(moveItem) || bulkMoveOpen}
        selectedCount={bulkMoveOpen ? selection.length : undefined}
      />
      <FileTrashDialog
        blockedByPublishing={trashBlockedByPublishing}
        item={trashItem}
        onConfirm={trashItem ? trashManagedItem : trashSelection}
        onOpenChange={(open) => {
          if (!open) {
            setTrashBlockedByPublishing(false)
            setTrashItem(null)
            setBulkTrashOpen(false)
          }
        }}
        open={Boolean(trashItem) || bulkTrashOpen}
        pending={trashPending}
        selectedCount={bulkTrashOpen ? selection.length : undefined}
      />
    </div>
  )
}
