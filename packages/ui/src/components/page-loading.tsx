import { cn } from "@workspace/ui/lib/utils"

import { Spinner } from "@workspace/ui/components/spinner"

function PageLoading({
  "aria-label": ariaLabel,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      aria-busy="true"
      aria-label={ariaLabel}
      className={cn("flex min-h-64 items-center justify-center", className)}
      role="status"
      {...props}
    >
      <Spinner size={28} />
    </div>
  )
}

export { PageLoading }
