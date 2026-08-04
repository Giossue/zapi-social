"use client"

import { useEffect, useState } from "react"
import { publishingApi } from "@workspace/api-client"
import type { PortalPublishingResponse } from "@workspace/contracts"
import { PublishingCalendarPage } from "@/features/publishing/components/publishing-calendar-page"

export function PublishingPageLoader({
  initialSection,
}: {
  initialSection?: "calendar" | "queue" | "drafts"
}) {
  const [calendar, setCalendar] = useState<PortalPublishingResponse | null>(
    null
  )

  useEffect(() => {
    void publishingApi
      .list()
      .then(setCalendar)
      .catch(() => setCalendar(null))
  }, [])

  if (!calendar) return null
  return (
    <PublishingCalendarPage
      calendar={calendar}
      initialSection={initialSection}
    />
  )
}
