"use client"

import { WatermarksErrorState } from "@/features/watermarks/components/watermarks-states"

export default function WatermarksErrorRoute({ reset }: { reset: () => void }) {
  return <WatermarksErrorState onRetry={reset} />
}
