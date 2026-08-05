import { CircleAlert, Droplets, ShieldCheck } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"

export function WatermarksPermissionState() {
  return (
    <EmptyState
      description="Tu rol actual no permite administrar las marcas de agua de este espacio de trabajo."
      icon={ShieldCheck}
      title="Marca de agua no disponible"
    />
  )
}

export function WatermarksErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No se pudieron cargar las marcas de agua</AlertTitle>
      <AlertDescription>
        Ninguna configuración fue modificada. Vuelve a intentarlo para recuperar
        el editor.
      </AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={onRetry} variant="brand-secondary">
          <Droplets data-icon="inline-start" /> Reintentar
        </Button>
      </div>
    </Alert>
  )
}
