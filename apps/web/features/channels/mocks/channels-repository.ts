import { channelsFixture } from "@/features/channels/fixtures/channels"
import type { PortalChannelsDashboard } from "@/features/channels/types/channels"

export async function getChannelsMock(): Promise<PortalChannelsDashboard> {
  return channelsFixture
}
