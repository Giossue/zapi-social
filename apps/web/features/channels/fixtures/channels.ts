import {
  BrandFacebook,
  BrandInstagram,
  BrandLinkedIn,
  BrandTikTok,
  BrandX,
  BrandWhatsApp,
} from "@/components/brand-icons"
import type { PortalChannelsDashboard } from "../types/channels"

/** Datos sintéticos deterministas para el mock del Portal. */
export const channelsFixture: PortalChannelsDashboard = {
  canView: true,
  canManage: true,
  planLimitReached: false,
  capabilities: [
    {
      key: "facebook_page",
      provider: "meta",
      icon: BrandFacebook,
      availability: "ready",
      connectionKind: "picker",
      candidates: [
        {
          id: "facebook-northstar",
          label: "Northstar Studio",
          description: "Página de Facebook",
          metadata: "42,8 mil seguidores",
        },
        {
          id: "facebook-garden",
          label: "Digital Garden",
          description: "Página de Facebook",
          metadata: "8,3 mil seguidores",
        },
      ],
    },
    {
      key: "instagram_profile",
      provider: "meta",
      icon: BrandInstagram,
      availability: "ready",
      connectionKind: "picker",
      candidates: [
        {
          id: "instagram-northstar",
          label: "@northstar.studio",
          description: "Perfil de Creator",
          metadata: "18,2 mil seguidores",
        },
      ],
    },
    {
      key: "whatsapp_status",
      provider: "whatsapp",
      icon: BrandWhatsApp,
      availability: "ready",
      connectionKind: "qr",
    },
    {
      key: "linkedin_page",
      provider: "linkedin",
      icon: BrandLinkedIn,
      availability: "coming_soon",
      connectionKind: "picker",
    },
    {
      key: "linkedin_profile",
      provider: "linkedin",
      icon: BrandLinkedIn,
      availability: "coming_soon",
      connectionKind: "direct",
    },
    {
      key: "x_profile",
      provider: "x",
      icon: BrandX,
      availability: "coming_soon",
      connectionKind: "direct",
    },
    {
      key: "tiktok_profile",
      provider: "tiktok",
      icon: BrandTikTok,
      availability: "plan_locked",
      connectionKind: "direct",
    },
  ],
  accounts: [
    {
      id: "channel-facebook-northstar",
      capabilityKey: "facebook_page",
      provider: "meta",
      displayName: "Northstar Studio",
      handle: "northstar.studio",
      status: "connected",
      connectedAt: "2026-07-18",
    },
    {
      id: "channel-instagram-northstar",
      capabilityKey: "instagram_profile",
      provider: "meta",
      displayName: "Northstar Studio",
      handle: "northstar.studio",
      status: "disconnected",
      connectedAt: "2026-07-12",
    },
  ],
}
