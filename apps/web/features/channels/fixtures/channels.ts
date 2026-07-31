import type { ChannelsDashboard } from "@/features/channels/types/channels"

/** Datos sintéticos heredados; la ruta de portal ya consume el API de canales. */
export const channelsFixture: ChannelsDashboard = {
  canManage: true,
  canConnect: false,
  readyProviders: [],
  metrics: { total: 0, active: 0, paused: 0, recent: 0 },
  providers: [],
  accounts: [],
}
