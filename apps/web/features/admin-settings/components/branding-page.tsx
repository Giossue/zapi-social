"use client"

import { adminSettingsApi } from "@workspace/api-client"
import type { AdminBrandingSettings } from "@workspace/contracts"
import { CheckIcon, UploadIcon } from "lucide-react"
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
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@workspace/ui/components/page-loading"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
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

const DEFAULT_PRIMARY = "#1d4ed8"

const SWATCHES = [
  "#1d4ed8",
  "#0ea5e9",
  "#0d9488",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#db2777",
  "#9333ea",
  "#4f46e5",
  "#475569",
  "#171717",
]

type AssetKey = (typeof ASSETS)[number]["key"]

export function BrandingSettingsPage() {
  const t = useTranslations("adminSettings.branding")
  const errorMessage = useApiErrorMessage()
  const [settings, setSettings] = useState<AdminBrandingSettings | null>(null)
  const [pending, setPending] = useState<AssetKey | "primaryColor" | null>(null)
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

  const onColor = async (primaryColor: string) => {
    if (!settings) return
    setPending("primaryColor")
    try {
      setSettings(
        await adminSettingsApi.saveBranding({ ...settings, primaryColor })
      )
      toast.success(t("colorSaved"))
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
        <CardContent className="flex flex-col gap-6">
          <PrimaryColorField
            value={settings.primaryColor}
            label={t("primaryColor")}
            hint={t("primaryColorHint")}
            resetLabel={t("restore")}
            pending={pending === "primaryColor"}
            onChange={onColor}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          </div>
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

function PrimaryColorField({
  value,
  label,
  hint,
  resetLabel,
  pending,
  onChange,
}: {
  value: string
  label: string
  hint: string
  resetLabel: string
  pending: boolean
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState(value || DEFAULT_PRIMARY)
  const current = value || DEFAULT_PRIMARY
  const isValid = /^#[0-9a-fA-F]{6}$/.test(draft)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="surface" disabled={pending}>
              <span
                aria-hidden="true"
                data-icon="inline-start"
                className="size-4 rounded-full border border-border"
                style={{ backgroundColor: current }}
              />
              <span className="font-mono">{current.toUpperCase()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="grid grid-cols-6 gap-2">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={swatch}
                  onClick={() => {
                    setDraft(swatch)
                    onChange(swatch)
                  }}
                  className="size-8 rounded-md border border-border"
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
            <form
              noValidate
              className="mt-4 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (isValid) onChange(draft.toLowerCase())
              }}
            >
              <Input
                value={draft}
                aria-label={label}
                onChange={(event) => setDraft(event.target.value)}
                className="font-mono"
              />
              <Button size="sm" type="submit" disabled={!isValid || pending}>
                <CheckIcon data-icon="inline-start" />
              </Button>
            </form>
          </PopoverContent>
        </Popover>
        {value ? (
          <Button
            size="sm"
            variant="brand-secondary"
            disabled={pending}
            onClick={() => {
              setDraft(DEFAULT_PRIMARY)
              onChange("")
            }}
          >
            {resetLabel}
          </Button>
        ) : null}
      </div>
      <span className="text-sm text-muted-foreground">{hint}</span>
    </div>
  )
}
