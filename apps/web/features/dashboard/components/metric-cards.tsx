import type { LucideIcon } from "lucide-react"
import {
  CalendarDays,
  FolderOpen,
  HardDrive,
  Layers3,
  Share2,
  Sparkles,
} from "lucide-react"

import { MetricCard } from "@workspace/ui/components/metric-card"
import { CardGrid } from "@workspace/ui/components/card-grid"

import type {
  DashboardMetric,
  DashboardMetricIcon,
} from "@/features/dashboard/types/dashboard"

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
    <CardGrid>
      {metrics.slice(0, 4).map((metric) => {
        const Icon = metricIcons[metric.icon]

        return (
          <MetricCard
            description={metric.description}
            icon={Icon}
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        )
      })}
    </CardGrid>
  )
}
