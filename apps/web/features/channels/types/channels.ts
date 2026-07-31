export type {
  ChannelAccount,
  ChannelList,
  ChannelOAuthProviderKey,
  ChannelMetrics,
  ChannelStatus,
  CreateChannelInput,
  UpdateChannelInput,
} from "@workspace/contracts"

/** @deprecated La ruta del portal obtiene datos desde channelsApi. */
export type ChannelsDashboard = import("@workspace/contracts").ChannelList
