"use client"

import type { LucideIcon } from "lucide-react"
import { CalendarDays, FolderOpen, Share2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { CardGrid } from "@workspace/ui/components/card-grid"
import { MetricCard } from "@workspace/ui/components/metric-card"

import type { PortalDashboard } from "@workspace/contracts"

type DashboardKpi = PortalDashboard["metrics"][number]

const metricIcons: Record<DashboardKpi["key"], LucideIcon> = {
  aiCredits: Sparkles,
  publishedPosts: CalendarDays,
  activeChannels: Share2,
  newFiles: FolderOpen,
}

export function MetricCards({ metrics }: { metrics: DashboardKpi[] }) {
  const t = useTranslations("dashboard.portal.metrics")

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
          value={metric.value}
        />
      ))}
    </CardGrid>
  )
}
