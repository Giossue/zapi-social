"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  FileText,
  Folder,
  Grid2X2,
  Image,
  List,
  MoreHorizontal,
  Search,
  Share2,
  Sparkles,
  Upload,
  Video,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import { FilesPermissionState } from "@/features/files/components/files-states"
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

function AssetMeta({ asset }: { asset: FileAsset }) {
  const { icon: AssetIcon, label } = assetKindMeta[asset.kind]

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <AssetIcon aria-hidden="true" className="size-3.5" />
        {label}
      </span>
      <span>{asset.size}</span>
      {asset.dimensions ? <span>{asset.dimensions}</span> : null}
    </div>
  )
}

function AssetCard({
  asset,
  selected,
  onSelect,
}: {
  asset: FileAsset
  selected: boolean
  onSelect: (id: string) => void
}) {
  const { icon: AssetIcon } = assetKindMeta[asset.kind]

  return (
    <Card variant={selected ? "interactive" : "subtle"}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <AssetIcon aria-hidden="true" className="size-5 text-muted-foreground" />
          </div>
          <Button
            aria-label={`${selected ? "Quitar" : "Seleccionar"} ${asset.name}`}
            onClick={() => onSelect(asset.id)}
            size="icon-sm"
            variant="brand-secondary"
          >
            <MoreHorizontal />
          </Button>
        </div>
        <CardTitle className="truncate">{asset.name}</CardTitle>
        <CardDescription>{asset.updatedAt}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <AssetMeta asset={asset} />
        <div className="flex flex-wrap gap-1.5">
          {asset.shared ? <Badge variant="info">Compartido</Badge> : null}
          {asset.generatedWithAi ? (
            <Badge variant="neutral">
              <Sparkles data-icon="inline-start" />
              Creado con AI
            </Badge>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <span className="text-xs text-muted-foreground">
          {selected ? "Seleccionado" : "Disponible"}
        </span>
        <Button onClick={() => onSelect(asset.id)} size="sm" variant="brand-secondary">
          {selected ? "Quitar" : "Seleccionar"}
        </Button>
      </CardFooter>
    </Card>
  )
}

function AssetsTable({
  assets,
  selectedAssetIds,
  onSelect,
}: {
  assets: readonly FileAsset[]
  selectedAssetIds: readonly string[]
  onSelect: (id: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Archivo</TableHead>
          <TableHead className="hidden md:table-cell">Tipo</TableHead>
          <TableHead className="hidden lg:table-cell">Actualizado</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => {
          const { icon: AssetIcon, label } = assetKindMeta[asset.kind]
          const selected = selectedAssetIds.includes(asset.id)

          return (
            <TableRow key={asset.id}>
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <AssetIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.size}</p>
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
                <Button
                  onClick={() => onSelect(asset.id)}
                  size="sm"
                  variant="brand-secondary"
                >
                  {selected ? "Quitar" : "Seleccionar"}
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function FilesLibraryPage({ library }: { library: FileLibraryData }) {
  const [query, setQuery] = useState("")
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all")
  const [folderId, setFolderId] = useState<string | "all">("all")
  const [view, setView] = useState<FilesView>("grid")
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  const assets = useMemo(
    () =>
      library.assets.filter((asset) =>
        assetMatches(asset, query, assetFilter, folderId)
      ),
    [assetFilter, folderId, library.assets, query]
  )

  function toggleAsset(id: string) {
    setSelectedAssetIds((current) =>
      current.includes(id)
        ? current.filter((assetId) => assetId !== id)
        : [...current, id]
    )
  }

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
            <Link href="/portal/files/search-online">
              <Image data-icon="inline-start" />
              Buscar online
            </Link>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {library.folders.map((folder) => (
          <Card key={folder.id} size="sm" variant="subtle">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <Folder aria-hidden="true" className="size-5 text-muted-foreground" />
                <Badge variant={folderId === folder.id ? "default" : "neutral"}>
                  {folder.fileCount} archivos
                </Badge>
              </div>
              <CardTitle className="truncate">{folder.name}</CardTitle>
              <CardDescription>{folder.updatedAt}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-between">
              <span className="text-xs text-muted-foreground">{folder.size}</span>
              <Button
                onClick={() =>
                  setFolderId((current) =>
                    current === folder.id ? "all" : folder.id
                  )
                }
                size="sm"
                variant="brand-secondary"
              >
                {folderId === folder.id ? "Ver todo" : "Abrir"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{assets.length} archivos</p>
            {selectedAssetIds.length > 0 ? (
              <Badge variant="info">{selectedAssetIds.length} seleccionados</Badge>
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
            }
            description="Prueba con otro término o restablece los filtros para consultar todos los archivos disponibles."
            icon={Search}
            title="No encontramos archivos"
          />
        ) : view === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {assets.map((asset) => (
              <AssetCard
                asset={asset}
                key={asset.id}
                onSelect={toggleAsset}
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
              Esta acción es un mock visual. La carga y el almacenamiento se
              conectarán cuando exista el contrato REST de Files.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUploadDialogOpen(false)} variant="brand-secondary">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
