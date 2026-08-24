"use client"

import { useEffect, useState } from "react"
import { publishingApi } from "@workspace/api-client"
import type { PortalPublishingResponse } from "@workspace/contracts"
import { Card, CardContent } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { PublishingCalendarPage } from "@/features/publishing/components/publishing-calendar-page"

let lastResponse: PortalPublishingResponse | null = null

export function PublishingPageLoader({
  initialSection,
}: {
  initialSection?: "calendar" | "queue" | "drafts"
}) {
  const t = useTranslations("publishing.loader")
  const [calendar, setCalendar] = useState<PortalPublishingResponse | null>(
    lastResponse
  )
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    void publishingApi
      .list()
      .then((response) => {
        lastResponse = response
        if (active) setCalendar(response)
      })
      .catch(() => {
        if (active && !lastResponse) setLoadError(true)
      })

    return () => {
      active = false
    }
  }, [])

  function retryLoad() {
    setLoadError(false)
    setCalendar(null)

    void publishingApi
      .list()
      .then((response) => {
        lastResponse = response
        setCalendar(response)
      })
      .catch(() => setLoadError(true))
  }

  if (loadError) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton onClick={retryLoad} variant="brand-secondary" />
            }
            description={t("loadFailedDescription")}
            icon={TriangleAlert}
            title={t("loadFailedTitle")}
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
