"use client"

import { CircleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"

type PublishingErrorPageProps = {
  reset: () => void
}

export default function PublishingErrorPage({
  reset,
}: PublishingErrorPageProps) {
  const t = useTranslations("routeStates")

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{t("publishing.title")}</AlertTitle>
      <AlertDescription>{t("publishing.description")}</AlertDescription>
      <AlertAction>
        <Button onClick={reset} size="sm" variant="brand-secondary">
          {t("retry")}
        </Button>
      </AlertAction>
    </Alert>
  )
}
