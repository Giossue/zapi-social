"use client"

import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { RefreshCw, TriangleAlert } from "lucide-react"

export default function AdminAiConfigurationError({
  reset,
}: {
  reset: () => void
}) {
  return (
    <Card variant="subtle">
      <EmptyState
        icon={TriangleAlert}
        title="No pudimos abrir Configuración AI"
        description="Reintenta para cargar el proveedor y los modelos."
        action={
          <Button onClick={reset} variant="brand-secondary">
            <RefreshCw data-icon="inline-start" /> Reintentar
          </Button>
        }
      />
    </Card>
  )
}
