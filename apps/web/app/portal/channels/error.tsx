"use client"

import { CircleAlert } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

export default function ChannelsErrorPage({ reset }: { reset: () => void }) {
  return (
    <Card variant="subtle">
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 text-destructive"
          />
          <div>
            <p className="font-semibold">No se pudieron cargar los canales</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No se modificó ninguna conexión. Intenta cargar la sección de nuevo.
            </p>
          </div>
        </div>
        <Button onClick={reset} variant="brand-secondary">
          Reintentar
        </Button>
      </CardContent>
    </Card>
  )
}
