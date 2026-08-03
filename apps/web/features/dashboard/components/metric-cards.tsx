import type { LucideIcon } from "lucide-react"
import { CalendarDays, FolderOpen, HardDrive, Layers3, Share2, Sparkles } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import type { DashboardMetric, DashboardMetricIcon } from "@/features/dashboard/types/dashboard"

const metricIcons: Record<DashboardMetricIcon, LucideIcon> = {
  ai: Sparkles,
  calendar: CalendarDays,
  channels: Share2,
  files: FolderOpen,
  storage: HardDrive,
  templates: Layers3,
}

export function MetricCards({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {metrics.slice(0, 4).map((metric) => {
        const Icon = metricIcons[metric.icon]

        return (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle>
                <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>
              </CardTitle>
              <CardDescription>{metric.label}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{metric.value}</div>
              </div>
              {metric.description ? <p className="text-muted-foreground text-sm">{metric.description}</p> : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
