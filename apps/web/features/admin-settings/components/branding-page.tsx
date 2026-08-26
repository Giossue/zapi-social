"use client"

import { adminSettingsApi } from "@workspace/api-client"
import type { AdminBrandingSettings } from "@workspace/contracts"
import { UploadIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { Spinner } from "@workspace/ui/components/spinner"

import { useApiErrorMessage } from "@/lib/api-error-message"

function apiErrorCode(error: unknown) {
  return error instanceof Error && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined
}
import { BUNDLED_BRANDING, resolveBrandingUrl } from "@/lib/branding"

const ASSETS = [
  { key: "favicon", fallback: BUNDLED_BRANDING.favicon },
  { key: "logoLight", fallback: BUNDLED_BRANDING.logoLight },
  { key: "logoDark", fallback: BUNDLED_BRANDING.logoDark },
  { key: "logoBrandLight", fallback: BUNDLED_BRANDING.logoBrandLight },
  { key: "logoBrandDark", fallback: BUNDLED_BRANDING.logoBrandDark },
] as const

type AssetKey = (typeof ASSETS)[number]["key"]

export function BrandingSettingsPage() {
  const t = useTranslations("adminSettings.branding")
  const errorMessage = useApiErrorMessage()
  const [settings, setSettings] = useState<AdminBrandingSettings | null>(null)
  const [pending, setPending] = useState<AssetKey | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    adminSettingsApi
      .branding()
      .then(setSettings)
      .catch(() => setFailed(true))
  }, [])

  const refresh = async () => {
    setSettings(await adminSettingsApi.branding())
  }

  const onUpload = async (asset: AssetKey, file: File) => {
    setPending(asset)
    try {
      await adminSettingsApi.uploadBrandingAsset(asset, file)
      await refresh()
      toast.success(t("uploaded"))
    } catch (error) {
      toast.error(errorMessage(apiErrorCode(error)))
    } finally {
      setPending(null)
    }
  }

  const onClear = async (asset: AssetKey) => {
    setPending(asset)
    try {
      await adminSettingsApi.clearBrandingAsset(asset)
      await refresh()
      toast.success(t("restored"))
    } catch (error) {
      toast.error(errorMessage(apiErrorCode(error)))
    } finally {
      setPending(null)
    }
  }

  if (failed) {
    return <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
  }
  if (!settings) return <PageLoading />

  return (
    <div className="flex flex-col gap-4">
      <Card variant="subtle">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ASSETS.map((asset) => (
            <AssetCard
              key={asset.key}
              assetKey={asset.key}
              label={t(`assets.${asset.key}`)}
              hint={t(`hints.${asset.key}`)}
              source={resolveBrandingUrl(settings[asset.key], asset.fallback)}
              isCustom={Boolean(settings[asset.key])}
              pending={pending === asset.key}
              chooseLabel={t("choose")}
              restoreLabel={t("restore")}
              onUpload={(file) => onUpload(asset.key, file)}
              onClear={() => onClear(asset.key)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function AssetCard({
  assetKey,
  label,
  hint,
  source,
  isCustom,
  pending,
  chooseLabel,
  restoreLabel,
  onUpload,
  onClear,
}: {
  assetKey: AssetKey
  label: string
  hint: string
  source: string
  isCustom: boolean
  pending: boolean
  chooseLabel: string
  restoreLabel: string
  onUpload: (file: File) => void
  onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <Card variant="inset">
      <CardHeader>
        <CardTitle className="text-sm">{label}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex h-24 items-center justify-center rounded-md bg-background p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={source} alt="" className="max-h-full max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UploadIcon data-icon="inline-start" />
            )}
            {chooseLabel}
          </Button>
          {isCustom ? (
            <Button
              size="sm"
              variant="brand-secondary"
              disabled={pending}
              onClick={onClear}
            >
              {restoreLabel}
            </Button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
          hidden
          name={assetKey}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
            event.target.value = ""
          }}
        />
      </CardContent>
    </Card>
  )
}
