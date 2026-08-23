"use client"

import { CircleAlert, Rss, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"

export function RssSchedulesPermissionState() {
  const t = useTranslations("rssSchedules")

  return (
    <EmptyState
      description={t("forbiddenDescription")}
      icon={ShieldCheck}
      title={t("unavailableTitle")}
    />
  )
}

export function RssSchedulesErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("rssSchedules")

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{t("loadFailedTitle")}</AlertTitle>
      <AlertDescription>{t("loadFailedDescription")}</AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={onRetry} variant="brand-secondary">
          <Rss data-icon="inline-start" />
          {t("retry")}
        </Button>
      </div>
    </Alert>
  )
}
