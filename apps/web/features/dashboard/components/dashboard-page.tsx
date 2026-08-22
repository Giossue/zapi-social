import { AiUsage } from "./ai-usage"
import { ChannelBreakdown } from "./channel-breakdown"
import { MetricCards } from "./metric-cards"
import { PublishingActivity } from "./publishing-activity"
import { UpcomingPosts } from "./upcoming-posts"

import type { PortalDashboard } from "@workspace/contracts"

export function PortalDashboardPage({
  dashboard,
}: {
  dashboard: PortalDashboard
}) {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <MetricCards metrics={dashboard.metrics} />
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <PublishingActivity data={dashboard.publishingActivity} />
        </div>
        <div className="xl:col-span-5">
          <AiUsage aiUsage={dashboard.aiUsage} />
        </div>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <UpcomingPosts upcoming={dashboard.upcoming} />
        </div>
        <div className="xl:col-span-5 xl:col-start-8">
          <ChannelBreakdown
            aiTools={dashboard.aiTools}
            channels={dashboard.channels}
          />
        </div>
      </div>
    </div>
  )
}
