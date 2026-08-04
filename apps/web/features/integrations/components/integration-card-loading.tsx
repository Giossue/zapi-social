import { Card, CardContent } from "@workspace/ui/components/card"
import { PageLoading } from "@workspace/ui/components/page-loading"

export function IntegrationCardLoading() {
  return (
    <Card aria-busy="true" variant="surface">
      <CardContent>
        <PageLoading className="min-h-72" />
      </CardContent>
    </Card>
  )
}
