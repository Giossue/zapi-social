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
import { Spinner } from "@workspace/ui/components/spinner"
import { useTranslations } from "next-intl"

type MediaKind = "image" | "video"

const filters: Array<MediaKind | "all"> = ["all", "image", "video"]

type PublishingMediaPickerProps = {
  ariaRequired?: boolean
  assets: PublishingMediaAsset[]
  onChange: (assetId: string | null) => void
  selectedAssetId: string | null
  driveEnabled?: boolean
  driveOpening?: boolean
  driveImportStatus?: "pending" | "processing" | "failed"
  onImportFromDrive?: () => void
}

export function PublishingMediaPicker({
  ariaRequired = false,
  assets,
  onChange,
  selectedAssetId,
  driveEnabled = false,
  driveOpening = false,
  driveImportStatus,
  onImportFromDrive,
}: PublishingMediaPickerProps) {
  const t = useTranslations("publishing.mediaPicker")
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
        <CardTitle>{t("title")}</CardTitle>
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
              aria-label={t("searchLabel")}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              value={query}
            />
          </InputGroup>
          <ToggleGroup
            aria-label={t("filterLabel")}
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
              <ToggleGroupItem key={filter} value={filter}>
                {t(`filter.${filter}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {driveEnabled ? (
          <Button
            disabled={
              driveOpening ||
              driveImportStatus === "processing" ||
              driveImportStatus === "pending"
            }
            onClick={onImportFromDrive}
            type="button"
            variant="brand-secondary"
          >
            {driveOpening ? <Spinner data-icon="inline-start" /> : null}
            {driveOpening ? t("driveOpening") : t("driveImport")}
          </Button>
        ) : null}
        {driveImportStatus ? (
          <Card size="sm" variant="surface">
            <CardContent className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {driveImportStatus === "failed"
                    ? t("driveFailedTitle")
                    : t("driveImportingTitle")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {driveImportStatus === "failed"
                    ? t("driveFailedDescription")
                    : t("driveImportingDescription")}
                </p>
              </div>
              {driveImportStatus === "failed" ? null : <Spinner />}
            </CardContent>
          </Card>
        ) : null}
        {visibleAssets.length ? (
          <div
            aria-label={t("selectedLabel")}
            aria-required={ariaRequired}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            role="radiogroup"
          >
            {visibleAssets.map((asset) => {
              const selected = asset.id === selectedAssetId
              const AssetIcon = asset.kind === "image" ? Image : Video
              return (
                <Button
                  aria-checked={selected}
                  className="h-auto min-h-28 flex-col items-start gap-3 p-3 text-left"
                  key={asset.id}
                  onClick={() => onChange(selected ? null : asset.id)}
                  role="radio"
                  type="button"
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
                      <span>{t(`kind.${asset.kind}`)}</span>
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
          <Badge variant="success">{t("selectedBadge")}</Badge>
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
