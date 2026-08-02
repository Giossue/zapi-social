import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

const workspaceMetricSkeletons = ["channels", "posts", "credits", "ai"] as const
const compactMetricSkeletons = ["one", "two", "three"] as const
const workflowSkeletons = ["content", "image", "repurpose", "timing"] as const
const attentionSkeletons = ["one", "two"] as const

function SectionHeaderLoading({ action = true }: { action?: boolean }) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-4">
      <div className="min-w-0 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-72 max-w-full" /></div>
      {action ? <Skeleton className="h-9 w-36 shrink-0" /> : null}
    </CardHeader>
  )
}

function MetricLoading({ compact = false }: { compact?: boolean }) {
  return (
    <Card className={compact ? "min-h-32" : "min-h-36"} variant="inset">
      <CardContent className="flex h-full flex-col justify-between gap-5"><div className="flex items-start justify-between"><Skeleton className="h-8 w-14" /><Skeleton className="size-5" /></div><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-32" /></div></CardContent>
    </Card>
  )
}

export function DashboardLoading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <Card variant="subtle"><SectionHeaderLoading action={false} /></Card>

      <Card variant="subtle">
        <SectionHeaderLoading />
        <CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{workspaceMetricSkeletons.map((metric) => <MetricLoading key={metric} />)}</div></CardContent>
      </Card>

      <Card variant="subtle">
        <SectionHeaderLoading />
        <CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{workflowSkeletons.map((workflow) => <Skeleton className="h-20" key={workflow} />)}</div></CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {["publishing", "library"].map((section) => (
          <Card key={section} variant="subtle">
            <SectionHeaderLoading />
            <CardContent><div className="grid gap-3 sm:grid-cols-3">{compactMetricSkeletons.map((metric) => <MetricLoading compact key={metric} />)}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card variant="subtle">
        <SectionHeaderLoading action={false} />
        <CardContent><div className="grid gap-3 md:grid-cols-2">{attentionSkeletons.map((item) => <Skeleton className="h-24" key={item} />)}</div></CardContent>
      </Card>
    </div>
  )
}
