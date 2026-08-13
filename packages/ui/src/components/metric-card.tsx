import type { ReactNode } from "react"

import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

type MetricCardProps = {
  description: ReactNode
  icon: LucideIcon
  label: ReactNode
  value: ReactNode
}

export function MetricCard({
  description,
  icon: Icon,
  label,
  value,
}: MetricCardProps) {
  return (
    <Card size="sm" variant="subtle">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <CardAction>
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <div className="text-xs text-muted-foreground">{description}</div>
      </CardContent>
    </Card>
  )
}
