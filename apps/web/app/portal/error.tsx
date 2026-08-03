"use client"

import { RouteErrorState } from "@/components/route-error-state"

export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <RouteErrorState
      reset={reset}
      title="No se pudo cargar el portal"
      description="No se modificó ningún dato. Inténtalo de nuevo."
    />
  )
}
