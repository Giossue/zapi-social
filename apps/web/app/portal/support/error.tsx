"use client"

import { SupportErrorState } from "@/features/support/components/support-states"

export default function SupportErrorRoute({ reset }: { reset: () => void }) {
  return <SupportErrorState onRetry={reset} />
}
