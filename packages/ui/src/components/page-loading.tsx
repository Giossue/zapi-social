import { cn } from "@workspace/ui/lib/utils"

import { Spinner } from "@workspace/ui/components/spinner"

function PageLoading({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando contenido"
      className={cn("flex min-h-64 items-center justify-center", className)}
      role="status"
      {...props}
    >
      <Spinner size={28} />
    </div>
  )
}

export { PageLoading }
