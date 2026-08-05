"use client"

import { RssSchedulesErrorState } from "@/features/rss-schedules/components/rss-schedules-states"

type RssSchedulesErrorRouteProps = {
  reset: () => void
}

export default function RssSchedulesErrorRoute({
  reset,
}: RssSchedulesErrorRouteProps) {
  return <RssSchedulesErrorState onRetry={reset} />
}
