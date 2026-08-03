"use client"

import { Button } from "@workspace/ui/components/button"

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <section className="max-w-xl space-y-3 py-4">
      <p className="text-sm font-medium text-destructive">
        No se pudo cargar el dashboard
      </p>
      <p className="text-muted-foreground">
        Intenta cargar de nuevo. No se modificó ningún dato.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </section>
  )
}
