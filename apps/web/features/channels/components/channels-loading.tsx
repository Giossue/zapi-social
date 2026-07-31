import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

const metricSkeletons = ["total", "active", "paused", "recent"] as const
const channelSkeletons = ["one", "two", "three"] as const

export function ChannelsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricSkeletons.map((metric) => (
          <Card key={metric}>
            <CardContent className="space-y-3">
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {channelSkeletons.map((channel) => (
          <Card key={channel}>
            <CardContent className="space-y-5">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
