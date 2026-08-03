"use client"

import { RouteErrorState } from "@/components/route-error-state"

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <RouteErrorState
      reset={reset}
      title="No se pudo cargar la administración"
      description="No se modificó ningún dato. Inténtalo de nuevo."
    />
  )
}
