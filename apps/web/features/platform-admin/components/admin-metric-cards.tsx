"use client"

import type { LucideIcon } from "lucide-react"
import { CreditCard, DollarSign, UserPlus, Users } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"

import { CardGrid } from "@workspace/ui/components/card-grid"
import { MetricCard } from "@workspace/ui/components/metric-card"

import type { AdminDashboard } from "@workspace/contracts"

type AdminKpi = AdminDashboard["metrics"][number]

const metricIcons: Record<AdminKpi["key"], LucideIcon> = {
  revenue: DollarSign,
  subscriptions: CreditCard,
  users: UserPlus,
  workspaces: Users,
}

export function AdminMetricCards({ metrics }: { metrics: AdminKpi[] }) {
  const t = useTranslations("dashboard.admin.metrics")
  const format = useFormatter()

  /** Con moneda, la API envía el importe en unidad menor sin formatear. */
  function metricValue(metric: AdminKpi) {
    if (!metric.currency) return metric.value
    return format.number(Number(metric.value) / 100, {
      currency: metric.currency,
      style: "currency",
    })
  }

  return (
    <CardGrid>
      {metrics.map((metric) => (
        <MetricCard
          description={
            metric.change
              ? `${metric.change.label} ${t(metric.descriptionKey)}`
              : t(metric.descriptionKey)
          }
          icon={metricIcons[metric.key]}
          key={metric.key}
          label={t(metric.key)}
          value={metricValue(metric)}
        />
      ))}
    </CardGrid>
  )
}
