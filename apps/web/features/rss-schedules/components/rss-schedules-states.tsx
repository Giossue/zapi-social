import { CircleAlert, Rss, ShieldCheck } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"

export function RssSchedulesPermissionState() {
  return (
    <EmptyState
      description="Tu acceso actual no permite consultar las programaciones RSS de este espacio de trabajo."
      icon={ShieldCheck}
      title="Programaciones RSS no disponibles"
    />
  )
}

export function RssSchedulesErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No se pudieron cargar las programaciones RSS</AlertTitle>
      <AlertDescription>
        Ninguna programación fue modificada. Vuelve a intentarlo para recuperar
        el contenido.
      </AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={onRetry} variant="brand-secondary">
          <Rss data-icon="inline-start" />
          Reintentar
        </Button>
      </div>
    </Alert>
  )
}
