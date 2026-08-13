"use client"

import { useEffect, useState } from "react"
import { publishingApi } from "@workspace/api-client"
import type { PortalPublishingResponse } from "@workspace/contracts"
import { Card, CardContent } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { TriangleAlert } from "lucide-react"
import { PublishingCalendarPage } from "@/features/publishing/components/publishing-calendar-page"

export function PublishingPageLoader({
  initialSection,
}: {
  initialSection?: "calendar" | "queue" | "drafts"
}) {
  const [calendar, setCalendar] = useState<PortalPublishingResponse | null>(
    null
  )
  const [loadError, setLoadError] = useState(false)

  function loadCalendar() {
    setLoadError(false)
    setCalendar(null)
    void publishingApi
      .list()
      .then(setCalendar)
      .catch(() => setLoadError(true))
  }

  useEffect(loadCalendar, [])

  if (loadError) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton onClick={loadCalendar} variant="brand-secondary" />
            }
            description="No pudimos recuperar el calendario. Ninguna publicación fue modificada."
            icon={TriangleAlert}
            title="No se pudo cargar Publishing"
          />
        </CardContent>
      </Card>
    )
  }
  if (!calendar) return <PageLoading />
  return (
    <PublishingCalendarPage
      calendar={calendar}
      initialSection={initialSection}
    />
  )
}
