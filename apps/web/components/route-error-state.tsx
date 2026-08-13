"use client"

import { Card } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { TriangleAlert } from "lucide-react"

type RouteErrorStateProps = {
  reset: () => void
  title: string
  description: string
}

export function RouteErrorState({
  reset,
  title,
  description,
}: RouteErrorStateProps) {
  return (
    <Card variant="subtle" className="max-w-xl">
      <EmptyState
        icon={TriangleAlert}
        title={title}
        description={description}
        action={<RetryButton onClick={reset} />}
      />
    </Card>
  )
}
