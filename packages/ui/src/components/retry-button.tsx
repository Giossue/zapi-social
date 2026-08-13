import { RefreshCw } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

type RetryButtonProps = React.ComponentProps<typeof Button> & {
  pending?: boolean
}

function RetryButton({
  children = "Reintentar",
  disabled,
  pending = false,
  ...props
}: RetryButtonProps) {
  return (
    <Button disabled={disabled || pending} {...props}>
      {pending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <RefreshCw aria-hidden="true" data-icon="inline-start" />
      )}
      {children}
    </Button>
  )
}

export { RetryButton }
