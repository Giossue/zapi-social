"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { publishingApi } from "@workspace/api-client"
import type { PortalPublishingResponse } from "@workspace/contracts"
import { Card, CardContent } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  PublishingCalendarPage,
  type PublishingSection,
} from "@/features/publishing/components/publishing-calendar-page"

let lastResponse: PortalPublishingResponse | null = null

const publishingSections = new Set<PublishingSection>([
  "calendar",
  "queue",
  "drafts",
  "bulk-posts",
])

export function PublishingPageLoader() {
  const t = useTranslations("publishing.loader")
  const searchParams = useSearchParams()
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
  const tab = searchParams.get("tab")
  const initialSection =
    tab && publishingSections.has(tab as PublishingSection)
      ? (tab as PublishingSection)
      : "calendar"

  return (
    <PublishingCalendarPage
      calendar={calendar}
      initialSection={initialSection}
    />
  )
}
