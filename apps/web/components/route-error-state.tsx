"use client"

import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
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
    <Card variant="surface" className="max-w-xl">
      <EmptyState
        icon={TriangleAlert}
        title={title}
        description={description}
        action={<Button onClick={reset}>Reintentar</Button>}
      />
    </Card>
  )
}
