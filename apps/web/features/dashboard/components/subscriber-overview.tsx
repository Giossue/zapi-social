import { Card } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"

import type { DashboardOverviewRow } from "./dashboard-overview-table/schema"
import { DashboardOverviewTable } from "./dashboard-overview-table/table"
import type { PortalDashboard } from "../types/dashboard"

function getDashboardOverviewRows(
  dashboard: PortalDashboard
): DashboardOverviewRow[] {
  return [
    ...dashboard.attention.map((item, index) => ({
      id: `attention-${index}`,
      category: "Atención" as const,
      title: item.label,
      detail: item.description,
      value: "",
      href: item.href,
    })),
    ...dashboard.publishing.map((metric, index) => ({
      id: `publishing-${index}`,
      category: "Publicación" as const,
      title: metric.label,
      detail: metric.description ?? "",
      value: metric.value,
      href: "/portal/publishing/calendar",
    })),
    ...dashboard.library.map((metric, index) => ({
      id: `library-${index}`,
      category: "Biblioteca" as const,
      title: metric.label,
      detail: metric.description ?? "",
      value: metric.value,
      href: "/portal/files",
    })),
  ]
}

export function SubscriberOverview({
  dashboard,
}: {
  dashboard: PortalDashboard
}) {
  const rows = getDashboardOverviewRows(dashboard)

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description="Alertas y métricas actuales de publicación y biblioteca."
        level="h2"
        title="Resumen operativo"
      />
      <Card variant="subtle">
        <DashboardOverviewTable data={rows} />
      </Card>
    </div>
  )
}
