"use client"

import { RouteErrorState } from "@/components/route-error-state"

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <RouteErrorState
      description="Intenta cargar de nuevo. No se modificó ningún dato."
      reset={reset}
      title="No se pudo cargar el dashboard"
    />
  )
}
