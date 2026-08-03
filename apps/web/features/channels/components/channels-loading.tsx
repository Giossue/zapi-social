import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

const metricSkeletons = ["total", "connected", "disconnected"] as const
const channelSkeletons = ["one", "two", "three"] as const

export function ChannelsLoading() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-36" />
      </div>
      <section className="space-y-3">
        <Card
          className="grid gap-0 overflow-hidden p-0 sm:grid-cols-3 sm:divide-x sm:divide-border"
          size="sm"
          variant="subtle"
        >
          {metricSkeletons.map((metric) => (
            <div className="flex items-center justify-between gap-3 px-4 py-3" key={metric}>
              <div className="space-y-2">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="size-4" />
            </div>
          ))}
        </Card>
        <Skeleton className="h-3 w-full max-w-xl" />
        <Card variant="subtle">
          <CardContent className="grid gap-4 px-0">
            <div className="grid gap-3 px-4 lg:grid-cols-[minmax(0,1fr)_12rem_14rem_12rem]">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
            <div className="grid gap-2 px-4 md:grid-cols-2 xl:grid-cols-3">
              {channelSkeletons.map((channel) => (
                <Card key={channel} size="sm" variant="surface">
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-18" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-7 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
