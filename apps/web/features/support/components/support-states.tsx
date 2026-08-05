import { CircleAlert, LifeBuoy, ShieldCheck } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"

export function SupportPermissionState() {
  return (
    <EmptyState
      description="Tu acceso actual no permite consultar los casos de soporte de este espacio de trabajo."
      icon={ShieldCheck}
      title="Soporte no disponible"
    />
  )
}

export function SupportErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No se pudieron cargar los casos de soporte</AlertTitle>
      <AlertDescription>
        Ningún caso fue modificado. Vuelve a intentarlo para recuperar la
        información.
      </AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={onRetry} variant="brand-secondary">
          <LifeBuoy data-icon="inline-start" />
          Reintentar
        </Button>
      </div>
    </Alert>
  )
}
