import { Skeleton } from "@workspace/ui/components/skeleton"

export default function TeamsLoadingPage() {
  return (
    <div aria-busy="true" className="space-y-5">
      <div className="flex justify-between gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
