import type { LucideIcon } from "lucide-react"
import { CreditCard, DollarSign, UserPlus, Users } from "lucide-react"

import { CardGrid } from "@workspace/ui/components/card-grid"
import { MetricCard } from "@workspace/ui/components/metric-card"

import type { AdminDashboard } from "@workspace/contracts"

type AdminKpi = AdminDashboard["metrics"][number]

const metricIcons: Record<AdminKpi["icon"], LucideIcon> = {
  revenue: DollarSign,
  subscriptions: CreditCard,
  users: UserPlus,
  workspaces: Users,
}

function metricDescription(metric: AdminKpi) {
  if (!metric.change) return metric.description
  return `${metric.change.label} ${metric.description}`
}

export function AdminMetricCards({ metrics }: { metrics: AdminKpi[] }) {
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
