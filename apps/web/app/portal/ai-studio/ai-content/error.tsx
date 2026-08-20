"use client"

import { CircleAlert } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"

type AIContentErrorRouteProps = {
  reset: () => void
}

export default function AIContentErrorRoute({
  reset,
}: AIContentErrorRouteProps) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No se pudo cargar AI Content</AlertTitle>
      <AlertDescription>
        Ningún prompt fue enviado ni se consumieron créditos. Vuelve a
        intentarlo para recuperar el mock.
      </AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={reset} variant="brand-secondary">
          Reintentar
        </Button>
      </div>
    </Alert>
  )
}
