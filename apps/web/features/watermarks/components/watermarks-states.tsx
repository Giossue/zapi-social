"use client"

import { useTranslations } from "next-intl"
import { CircleAlert, Droplets, ShieldCheck } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"

export function WatermarksPermissionState() {
  const t = useTranslations("watermarks")

  return (
    <EmptyState
      description={t("forbiddenDescription")}
      icon={ShieldCheck}
      title={t("unavailable")}
    />
  )
}

export function WatermarksErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("watermarks")

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{t("loadFailed")}</AlertTitle>
      <AlertDescription>{t("loadFailedDescription")}</AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={onRetry} variant="brand-secondary">
          <Droplets data-icon="inline-start" /> {t("retry")}
        </Button>
      </div>
    </Alert>
  )
}
