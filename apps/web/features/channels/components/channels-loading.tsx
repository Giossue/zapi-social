import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

const metricSkeletons = ["total", "connected", "disconnected"] as const
const channelSkeletons = ["one", "two", "three"] as const

export function ChannelsLoading() {
  return (
    <div className="space-y-7">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-40" />
      </div>
      <section className="space-y-4 border-t border-border pt-7">
        <div className="grid gap-3 sm:grid-cols-3">
          {metricSkeletons.map((metric) => (
            <Card key={metric} variant="subtle">
              <CardContent className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <Skeleton className="h-8 w-10" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="size-5" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_14rem_12rem]">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {channelSkeletons.map((channel) => (
            <Card key={channel} variant="subtle">
              <CardContent className="space-y-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                </div>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
