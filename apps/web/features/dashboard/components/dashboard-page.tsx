import { MetricCards } from "./metric-cards"
import { PerformanceOverview } from "./performance-overview"
import { SubscriberOverview } from "./subscriber-overview"
import type { PortalDashboard } from "../types/dashboard"

export function PortalDashboardPage({ dashboard }: { dashboard: PortalDashboard }) {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <MetricCards metrics={dashboard.workspace} />
      <PerformanceOverview tools={dashboard.tools} />
      <SubscriberOverview dashboard={dashboard} />
    </div>
  )
}
