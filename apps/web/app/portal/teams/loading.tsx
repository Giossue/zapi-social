import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

const memberSkeletons = ["one", "two", "three"] as const

export default function TeamsLoadingPage() {
  return (
    <div aria-busy="true" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <Card variant="subtle">
        <div className="grid gap-2 border-b px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-8 w-36" />
        </div>
        <CardContent className="grid gap-4 px-0">
          <div className="px-4">
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="divide-y border-y">
            {memberSkeletons.map((member) => (
              <div className="flex items-center justify-between gap-4 px-4 py-3" key={member}>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card size="sm" variant="subtle">
        <div className="space-y-2 border-b px-3 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
        </div>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-20" />
        </CardContent>
      </Card>
    </div>
  )
}
