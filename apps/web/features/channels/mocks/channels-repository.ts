import { channelsFixture } from "@/features/channels/fixtures/channels"
import type { ChannelsDashboard } from "@/features/channels/types/channels"

export async function getChannelsMock(): Promise<ChannelsDashboard> {
  return channelsFixture
}
