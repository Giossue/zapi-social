import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

export function IntegrationCardLoading() {
  return (
    <Card aria-busy="true" variant="surface">
      <CardHeader className="gap-4 border-b border-border pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2"><Skeleton className="h-6 w-28" /><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
      </CardHeader>
      <CardContent className="space-y-7">
        <div className="space-y-3"><Skeleton className="h-4 w-32" /><div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div></div>
        <div className="space-y-3"><Skeleton className="h-4 w-48" /><div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div></div>
        <div className="space-y-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
      </CardContent>
    </Card>
  )
}
