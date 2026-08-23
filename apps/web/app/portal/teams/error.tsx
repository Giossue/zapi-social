"use client"

import { CircleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

export default function TeamsErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("routeStates")

  return (
    <Card variant="subtle">
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 text-destructive"
          />
          <div>
            <p className="font-semibold">{t("teams.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("teams.description")}
            </p>
          </div>
        </div>
        <Button onClick={reset} variant="brand-secondary">
          {t("retry")}
        </Button>
      </CardContent>
    </Card>
  )
}
