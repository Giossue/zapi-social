import { portalDashboardFixture } from "@/features/dashboard/fixtures/portal-dashboard"
import type { PortalDashboard } from "@/features/dashboard/types/dashboard"

export async function getPortalDashboardMock(): Promise<PortalDashboard> {
  return portalDashboardFixture
}
