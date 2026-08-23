import type { LucideIcon } from "lucide-react"
import { CalendarDays, FolderOpen, Share2, Sparkles } from "lucide-react"

import { CardGrid } from "@workspace/ui/components/card-grid"
import { MetricCard } from "@workspace/ui/components/metric-card"

import type { PortalDashboard } from "@workspace/contracts"

type DashboardKpi = PortalDashboard["metrics"][number]

const metricIcons: Record<DashboardKpi["icon"], LucideIcon> = {
  ai: Sparkles,
  calendar: CalendarDays,
  channels: Share2,
  files: FolderOpen,
}

function metricDescription(metric: DashboardKpi) {
  if (!metric.change) return metric.description
  return `${metric.change.label} ${metric.description}`
}

export function MetricCards({ metrics }: { metrics: DashboardKpi[] }) {
  return (
    <CardGrid>
      {metrics.map((metric) => (
        <MetricCard
          description={metricDescription(metric)}
          icon={metricIcons[metric.icon]}
          key={metric.label}
          label={metric.label}
          value={metric.value}
        />
      ))}
    </CardGrid>
  )
}
