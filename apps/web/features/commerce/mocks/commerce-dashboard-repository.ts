import { commerceDashboardFixture } from "@/features/commerce/fixtures/commerce-dashboard"
import type { CommerceDashboardData } from "@/features/commerce/types/commerce-dashboard"

export async function getCommerceDashboardMock(): Promise<CommerceDashboardData> {
  return commerceDashboardFixture
}
