"use client"

import { useTranslations } from "next-intl"

import { CircleAlert, LifeBuoy, ShieldCheck } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"

export function SupportPermissionState() {
  const t = useTranslations("support")

  return (
    <EmptyState
      description={t("forbiddenDescription")}
      icon={ShieldCheck}
      title={t("unavailableTitle")}
    />
  )
}

export function SupportErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("support")

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{t("loadFailedTitle")}</AlertTitle>
      <AlertDescription>{t("loadFailedDescription")}</AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={onRetry} variant="brand-secondary">
          <LifeBuoy data-icon="inline-start" />
          {t("retry")}
        </Button>
      </div>
    </Alert>
  )
}
