"use client"

import { CircleAlert } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"

type AIContentErrorRouteProps = {
  reset: () => void
}

export default function AIContentErrorRoute({
  reset,
}: AIContentErrorRouteProps) {
  const t = useTranslations("routeStates")

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{t("aiContent.title")}</AlertTitle>
      <AlertDescription>{t("aiContent.description")}</AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={reset} variant="brand-secondary">
          {t("retry")}
        </Button>
      </div>
    </Alert>
  )
}
