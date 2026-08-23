"use client"

import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"
import { Card } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { RefreshCw, TriangleAlert } from "lucide-react"

export default function AdminAiConfigurationError({
  reset,
}: {
  reset: () => void
}) {
  const t = useTranslations("routeStates")

  return (
    <Card variant="subtle">
      <EmptyState
        icon={TriangleAlert}
        title={t("aiConfiguration.title")}
        description={t("aiConfiguration.description")}
        action={
          <Button onClick={reset} variant="brand-secondary">
            <RefreshCw data-icon="inline-start" /> {t("retry")}
          </Button>
        }
      />
    </Card>
  )
}
