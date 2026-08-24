import type { ComponentType, SVGProps } from "react"

export type ChannelProviderKey =
  "meta" | "linkedin" | "x" | "tiktok" | "whatsapp"
export type ChannelCapabilityKey =
  | "facebook_page"
  | "instagram_profile"
  | "linkedin_page"
  | "linkedin_profile"
  | "x_profile"
  | "tiktok_profile"
  | "whatsapp_status"

export type ChannelAvailability = "ready" | "coming_soon" | "plan_locked"
export type ChannelConnectionKind =
  "picker" | "direct" | "qr" | "oauth_direct" | "oauth_picker" | "qr_device"
export type ChannelAccountStatus = "connected" | "disconnected"

export type ChannelCandidate = {
  id: string
  label: string
  description: string
  metadata?: string
  avatarUrl?: string | null
}

export type PortalChannelCapability = {
  key: ChannelCapabilityKey
  provider: ChannelProviderKey
  icon: ComponentType<SVGProps<SVGSVGElement>>
  availability: ChannelAvailability
  connectionKind: ChannelConnectionKind
  candidates?: readonly ChannelCandidate[]
}

export type PortalChannelAccount = {
  id: string
  capabilityKey: ChannelCapabilityKey
  provider: ChannelProviderKey
  displayName: string
  externalName?: string | null
  handle?: string
  avatarUrl?: string | null
  status: ChannelAccountStatus
  connectedAt: string
}

export type PortalChannelsDashboard = {
  canView: boolean
  canManage: boolean
  planLimitReached: boolean
  capabilities: readonly PortalChannelCapability[]
  accounts: readonly PortalChannelAccount[]
}
