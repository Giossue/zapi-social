import type { LucideIcon } from "lucide-react"
import {
  CreditCard,
  DollarSign,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { MetricCard } from "@workspace/ui/components/metric-card"

import type { AdminDashboard } from "@workspace/contracts"

type AdminKpi = AdminDashboard["metrics"][number]

const metricIcons: Record<AdminKpi["icon"], LucideIcon> = {
  revenue: DollarSign,
  subscriptions: CreditCard,
  users: UserPlus,
  workspaces: Users,
}

export function AdminMetricCards({ metrics }: { metrics: AdminKpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard
          description={
            <span className="flex flex-wrap items-center gap-1.5">
              {metric.change ? (
                <Badge
                  variant={
                    metric.change.direction === "down"
                      ? "destructive"
                      : "default"
                  }
                >
                  {metric.change.direction === "down" ? (
                    <TrendingDown className="size-3" />
                  ) : (
                    <TrendingUp className="size-3" />
                  )}
                  {metric.change.label}
                </Badge>
              ) : null}
              <span>{metric.description}</span>
            </span>
          }
          icon={metricIcons[metric.icon]}
          key={metric.label}
          label={metric.label}
          value={metric.value}
        />
      ))}
    </div>
  )
}
