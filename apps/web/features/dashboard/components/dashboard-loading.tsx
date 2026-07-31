import { Skeleton } from "@workspace/ui/components/skeleton"

const metricSkeletons = ["channels", "posts", "credits", "ai"] as const

export function DashboardLoading() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricSkeletons.map((metric) => (
          <Skeleton key={metric} className="h-40" />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </section>
    </div>
  )
}
