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
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  )
}

export { PageLoading }
