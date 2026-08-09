"use client"

import { CircleAlert, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"

export default function AIStudioErrorRoute({ reset }: { reset: () => void }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No se pudo cargar AI Studio</AlertTitle>
      <AlertDescription>
        Ninguna generación fue enviada ni se consumieron créditos.
      </AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={reset} variant="brand-secondary">
          <RefreshCw data-icon="inline-start" />
          Reintentar
        </Button>
      </div>
    </Alert>
  )
}
