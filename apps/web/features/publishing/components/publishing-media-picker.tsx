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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import type { PublishingMediaAsset } from "@/features/publishing/types/publishing-calendar"

type MediaKind = "image" | "video"

const filters: Array<{ label: string; value: MediaKind | "all" }> = [
  { label: "Todo", value: "all" },
  { label: "Imágenes", value: "image" },
  { label: "Videos", value: "video" },
]

type PublishingMediaPickerProps = {
  assets: PublishingMediaAsset[]
  onChange: (assetId: string | null) => void
  selectedAssetId: string | null
}

export function PublishingMediaPicker({
  assets,
  onChange,
  selectedAssetId,
}: PublishingMediaPickerProps) {
  const [kind, setKind] = useState<MediaKind | "all">("all")
  const [query, setQuery] = useState("")
  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return assets.filter(
      (asset) =>
        (kind === "all" || asset.kind === kind) &&
        (!normalizedQuery ||
          asset.name.toLocaleLowerCase("es").includes(normalizedQuery))
    )
  }, [assets, kind, query])

  return (
    <Card size="sm" variant="inset">
      <CardHeader>
        <CardTitle>Selecciona desde tu almacenamiento</CardTitle>
        <CardDescription>
          Elige una imagen o video de Files para adjuntarlo a esta publicación.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <InputGroup className="sm:flex-1">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Buscar media en el almacenamiento"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en tu almacenamiento"
              value={query}
            />
          </InputGroup>
          <ToggleGroup
            aria-label="Filtrar media por tipo"
            onValueChange={(value) =>
              value && setKind(value as MediaKind | "all")
            }
            size="sm"
            spacing={1}
            type="single"
            value={kind}
            variant="outline"
          >
            {filters.map((filter) => (
              <ToggleGroupItem key={filter.value} value={filter.value}>
                {filter.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {visibleAssets.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visibleAssets.map((asset) => {
              const selected = asset.id === selectedAssetId
              const AssetIcon = asset.kind === "image" ? Image : Video
              return (
                <Button
                  className="h-auto min-h-28 flex-col items-start gap-3 p-3 text-left"
                  key={asset.id}
                  onClick={() => onChange(selected ? null : asset.id)}
                  variant={selected ? "default" : "brand-secondary"}
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <AssetIcon />
                  </span>
                  <span className="w-full">
                    <span className="block truncate text-sm font-medium">
                      {asset.name}
                    </span>
                    <span className="mt-1 flex items-center justify-between text-xs">
                      <span>{asset.kind === "image" ? "Imagen" : "Video"}</span>
                      {selected ? <Check aria-hidden="true" /> : null}
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
