"use client"

import { useTranslations } from "next-intl"
import { CircleAlert, RefreshCw } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"

export default function AIStudioErrorRoute({ reset }: { reset: () => void }) {
  const t = useTranslations("aiStudio.errorRoute")

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>{t("description")}</AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={reset} variant="brand-secondary">
          <RefreshCw data-icon="inline-start" />
          {t("retry")}
        </Button>
      </div>
    </Alert>
  )
}
