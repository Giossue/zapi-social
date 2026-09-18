import { cn } from "@workspace/ui/lib/utils"

import { Skeleton } from "@workspace/ui/components/skeleton"

function PageLoading({
  "aria-label": ariaLabel,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      aria-busy="true"
      aria-label={ariaLabel}
      className={cn("flex min-h-64 flex-col gap-4 p-4", className)}
      role="status"
      {...props}
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  )
}

export { PageLoading }
