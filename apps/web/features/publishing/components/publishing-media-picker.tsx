"use client"

import { useMemo, useState } from "react"
import { Check, Image, Search, Video } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"

type MediaKind = "image" | "video"

type MediaAsset = {
  id: string
  kind: MediaKind
  name: string
}

const mediaAssets: MediaAsset[] = [
  { id: "campaign-launch", kind: "image", name: "Lanzamiento de campaña" },
  { id: "studio-team", kind: "image", name: "Equipo en el estudio" },
  { id: "product-reel", kind: "video", name: "Video de producto" },
  { id: "community-event", kind: "image", name: "Evento de comunidad" },
  { id: "behind-scenes", kind: "video", name: "Detrás de cámaras" },
  { id: "brand-detail", kind: "image", name: "Detalle de marca" },
]

const filters: Array<{ label: string; value: MediaKind | "all" }> = [
  { label: "Todo", value: "all" },
  { label: "Imágenes", value: "image" },
  { label: "Videos", value: "video" },
]

type PublishingMediaPickerProps = {
  onChange: (assetId: string | null) => void
  selectedAssetId: string | null
}

export function PublishingMediaPicker({
  onChange,
  selectedAssetId,
}: PublishingMediaPickerProps) {
  const [kind, setKind] = useState<MediaKind | "all">("all")
  const [query, setQuery] = useState("")
  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return mediaAssets.filter(
      (asset) =>
        (kind === "all" || asset.kind === kind) &&
        (!normalizedQuery ||
          asset.name.toLocaleLowerCase("es").includes(normalizedQuery))
    )
  }, [kind, query])

  return (
    <Card variant="inset">
      <CardHeader>
        <CardTitle>Selecciona desde tu almacenamiento</CardTitle>
        <CardDescription>
          Elige una imagen o video de Files para adjuntarlo a esta publicación.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Buscar media en el almacenamiento"
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en tu almacenamiento"
              value={query}
            />
          </div>
          <div
            aria-label="Filtrar media por tipo"
            className="flex flex-wrap gap-2"
          >
            {filters.map((filter) => (
              <Button
                key={filter.value}
                onClick={() => setKind(filter.value)}
                size="sm"
                variant={kind === filter.value ? "default" : "brand-secondary"}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
        {visibleAssets.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visibleAssets.map((asset) => {
              const selected = asset.id === selectedAssetId
              const AssetIcon = asset.kind === "image" ? Image : Video
              return (
                <Button
                  className="h-auto min-h-32 flex-col items-start gap-3 p-3 text-left"
                  key={asset.id}
                  onClick={() => onChange(selected ? null : asset.id)}
                  variant={selected ? "default" : "brand-secondary"}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <AssetIcon className="size-5" />
                  </span>
                  <span className="w-full">
                    <span className="block truncate text-sm font-medium">
                      {asset.name}
                    </span>
                    <span className="mt-1 flex items-center justify-between text-xs">
                      <span>{asset.kind === "image" ? "Imagen" : "Video"}</span>
                      {selected ? <Check className="size-4" /> : null}
                    </span>
                  </span>
                </Button>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No encontramos media con esos filtros.
          </p>
        )}
        {selectedAssetId ? (
          <Badge variant="success">Media seleccionada</Badge>
        ) : (
          <p className="text-sm text-muted-foreground">
            Puedes publicar solo texto en Facebook. Instagram y WhatsApp
            requieren media.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
