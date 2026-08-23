"use client"

import { FilesErrorState } from "@/features/files/components/files-states"

type OnlineMediaSearchErrorRouteProps = {
  reset: () => void
}

export default function OnlineMediaSearchErrorRoute({
  reset,
}: OnlineMediaSearchErrorRouteProps) {
  return <FilesErrorState onRetry={reset} section="search" />
}
