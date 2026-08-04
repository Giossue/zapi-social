import { CircleAlert, FolderLock, Image, Search } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"
export function FilesPermissionState({ mode }: { mode: "library" | "search" }) {
  const isSearch = mode === "search"

  return (
    <EmptyState
      description={
        isSearch
          ? "Tu acceso actual no permite buscar medios online para este espacio de trabajo."
          : "Tu acceso actual no permite consultar los archivos de este espacio de trabajo."
      }
      icon={isSearch ? Search : FolderLock}
      title={
        isSearch ? "Búsqueda online no disponible" : "Biblioteca no disponible"
      }
    />
  )
}

export function FilesErrorState({
  onRetry,
  section,
}: {
  onRetry: () => void
  section: "biblioteca" | "búsqueda"
}) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No se pudo cargar la {section}</AlertTitle>
      <AlertDescription>
        Ningún archivo fue modificado. Vuelve a intentarlo para recuperar el
        contenido.
      </AlertDescription>
      <div className="mt-3 flex">
        <Button onClick={onRetry} variant="brand-secondary">
          <Image data-icon="inline-start" />
          Reintentar
        </Button>
      </div>
    </Alert>
  )
}
