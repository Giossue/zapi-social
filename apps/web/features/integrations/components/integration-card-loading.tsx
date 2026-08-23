import { Card, CardContent } from "@workspace/ui/components/card"
import { PageLoading } from "@/components/page-loading"

export function IntegrationCardLoading() {
  return (
    <Card aria-busy="true" variant="subtle">
      <CardContent>
        <PageLoading className="min-h-72" />
      </CardContent>
    </Card>
  )
}
