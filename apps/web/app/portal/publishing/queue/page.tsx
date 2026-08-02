import { PublishingCalendarPage } from "@/features/publishing/components/publishing-calendar-page"
import { getPublishingCalendarMock } from "@/features/publishing/mocks/publishing-calendar-repository"

export default async function PublishingQueueRoutePage() {
  const calendar = await getPublishingCalendarMock()

  return <PublishingCalendarPage calendar={calendar} initialSection="queue" />
}
