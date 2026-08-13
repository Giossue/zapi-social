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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
    </div>
  )
}
