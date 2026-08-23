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
/** Local values preserve the approved mock flow; OAuth values are returned by the Portal API. */
export type ChannelConnectionKind =
  "picker" | "direct" | "qr" | "oauth_direct" | "oauth_picker" | "qr_device"
export type ChannelAccountStatus = "connected" | "disconnected"

export type ChannelCandidate = {
  id: string
  label: string
  description: string
  metadata?: string
  /** OAuth candidates return this nullable field; it remains optional for approved local fixtures. */
  avatarUrl?: string | null
}

export type PortalChannelCapability = {
  key: ChannelCapabilityKey
  provider: ChannelProviderKey
  label: string
  description: string
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
  /** Provider identity, independent from the editable local display name. */
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
