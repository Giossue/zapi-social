import type { ComponentType, SVGProps } from "react"

export type ChannelConnectionProvider =
  "meta" | "linkedin" | "x" | "tiktok" | "whatsapp"

export type ChannelCapabilityKey =
  | "facebook_page"
  | "instagram_profile"
  | "linkedin_page"
  | "linkedin_profile"
  | "x_profile"
  | "tiktok_profile"
  | "whatsapp_status"

export type ConnectionResource = {
  id: string
  label: string
  description: string
  metadata?: string
}

export type ChannelConnectionCapability = {
  key: ChannelCapabilityKey
  provider: ChannelConnectionProvider
  label: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  flow: "oauth-picker" | "oauth-direct" | "pkce-direct" | "creator-info" | "qr"
  resources?: readonly ConnectionResource[]
}
