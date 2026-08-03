import type { ReactNode } from "react"

import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

export function IntegrationInsetCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Card className="gap-0 py-0" variant="inset">
      <CardContent className={cn("px-4 py-4", className)}>
        {children}
      </CardContent>
    </Card>
  )
}
