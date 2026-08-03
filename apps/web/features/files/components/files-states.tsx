import { CircleAlert, FolderLock, Image, Search } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Skeleton } from "@workspace/ui/components/skeleton"

export function FilesLibraryLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between gap-3">
        <Skeleton className="h-8 min-w-64 flex-1" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["one", "two", "three", "four"].map((item) => (
          <Skeleton className="h-28" key={item} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["five", "six", "seven", "eight"].map((item) => (
          <Skeleton className="h-60" key={item} />
        ))}
      </div>
    </div>
  )
}

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
      title={isSearch ? "Búsqueda online no disponible" : "Biblioteca no disponible"}
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
        Ningún archivo fue modificado. Vuelve a intentarlo para recuperar el contenido.
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
