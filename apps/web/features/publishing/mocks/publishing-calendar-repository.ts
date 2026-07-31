import { publishingCalendarFixture } from "@/features/publishing/fixtures/publishing-calendar"
import type { PublishingCalendarData } from "@/features/publishing/types/publishing-calendar"

export async function getPublishingCalendarMock(): Promise<PublishingCalendarData> {
  return publishingCalendarFixture
}
