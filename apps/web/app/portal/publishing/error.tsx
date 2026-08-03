"use client"

import { CircleAlert } from "lucide-react"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"

type PublishingErrorPageProps = {
  reset: () => void
}

export default function PublishingErrorPage({
  reset,
}: PublishingErrorPageProps) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No se pudo cargar Publishing</AlertTitle>
      <AlertDescription>
        Ninguna publicación fue modificada. Intenta cargar la sección de nuevo.
      </AlertDescription>
      <AlertAction>
        <Button onClick={reset} size="sm" variant="brand-secondary">
          Reintentar
        </Button>
      </AlertAction>
    </Alert>
  )
}
