"use client"

import { CommerceErrorState } from "@/features/commerce/components/commerce-dashboard-page"

type CommerceErrorRouteProps = {
  reset: () => void
}

export default function CommerceErrorRoute({ reset }: CommerceErrorRouteProps) {
  return <CommerceErrorState onRetry={reset} />
}
