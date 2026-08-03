import { CommerceDashboardPage } from "@/features/commerce/components/commerce-dashboard-page"
import { getCommerceDashboardMock } from "@/features/commerce/mocks/commerce-dashboard-repository"

export default async function CommerceRoutePage() {
  const dashboard = await getCommerceDashboardMock()

  return <CommerceDashboardPage dashboard={dashboard} />
}
