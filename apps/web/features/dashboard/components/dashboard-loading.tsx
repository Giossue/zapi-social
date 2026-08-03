import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

const metricSkeletons = ["channels", "posts", "credits", "ai"] as const
const tableSkeletons = ["one", "two", "three", "four"] as const

function MetricLoading() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="size-7" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-24" />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  )
}

export function DashboardLoading() {
  return (
    <div aria-busy="true" className="@container/main flex flex-col gap-4 md:gap-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {metricSkeletons.map((metric) => (
          <MetricLoading key={metric} />
        ))}
      </div>

      <Card className="@container/card">
        <CardHeader>
          <CardTitle className="leading-none">
            <Skeleton className="h-5 w-44" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="leading-none">
            <Skeleton className="h-5 w-40" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-96 max-w-full" />
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-hidden rounded-lg border bg-card">
            {tableSkeletons.map((row) => (
              <Skeleton className="h-14 rounded-none border-b last:border-b-0" key={row} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
