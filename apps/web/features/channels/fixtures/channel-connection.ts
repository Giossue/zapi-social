import {
  AtSign,
  Building2,
  LayoutPanelTop,
  Music2,
  QrCode,
  UserRound,
} from "lucide-react"
import type {
  ChannelConnectionCapability,
  ChannelCapabilityKey,
  ConnectionResource,
} from "../types/channel-connection"

export const channelConnectionCapabilities: readonly ChannelConnectionCapability[] =
  [
    {
      key: "facebook_page",
      provider: "meta",
      label: "Facebook Page",
      description: "Selecciona una página de Facebook que administras.",
      icon: LayoutPanelTop,
      flow: "oauth-picker",
      resources: [
        {
          id: "fb-northstar",
          label: "Northstar Studio",
          description: "Página de Facebook",
          metadata: "42.8 mil seguidores",
        },
        {
          id: "fb-digital-garden",
          label: "Digital Garden",
          description: "Página de Facebook",
          metadata: "8.3 mil seguidores",
        },
      ],
    },
    {
      key: "instagram_profile",
      provider: "meta",
      label: "Instagram Profile",
      description: "Selecciona un perfil profesional de Instagram vinculado.",
      icon: AtSign,
      flow: "oauth-picker",
      resources: [
        {
          id: "ig-northstar",
          label: "@northstar.studio",
          description: "Perfil de creador",
          metadata: "18.2 mil seguidores",
        },
        {
          id: "ig-digital-garden",
          label: "@digital.garden",
          description: "Perfil de empresa",
          metadata: "6.7 mil seguidores",
        },
      ],
    },
    {
      key: "linkedin_page",
      provider: "linkedin",
      label: "LinkedIn Page",
      description: "Elige una organización que administras en LinkedIn.",
      icon: Building2,
      flow: "oauth-picker",
      resources: [
        {
          id: "li-northstar",
          label: "Northstar Studio",
          description: "Página de organización",
          metadata: "1.240 seguidores",
        },
        {
          id: "li-digital-garden",
          label: "Digital Garden Labs",
          description: "Página de organización",
          metadata: "408 seguidores",
        },
      ],
    },
    {
      key: "linkedin_profile",
      provider: "linkedin",
      label: "LinkedIn Profile",
      description: "Conecta directamente el perfil que autorices en LinkedIn.",
      icon: UserRound,
      flow: "oauth-direct",
    },
    {
      key: "x_profile",
      provider: "x",
      label: "X Profile",
      description: "Autoriza un perfil de X mediante OAuth 2.0 con PKCE.",
      icon: AtSign,
      flow: "pkce-direct",
    },
    {
      key: "tiktok_profile",
      provider: "tiktok",
      label: "TikTok Profile",
      description:
        "Autoriza un perfil y revisa la información pública de creator.",
      icon: Music2,
      flow: "creator-info",
    },
    {
      key: "whatsapp_status",
      provider: "whatsapp",
      label: "WhatsApp Status",
      description: "Vincula un dispositivo escaneando un QR desde WhatsApp.",
      icon: QrCode,
      flow: "qr",
    },
  ]

export const directConnectionResources: Partial<
  Record<ChannelCapabilityKey, ConnectionResource>
> = {
  linkedin_profile: {
    id: "li-profile-ana",
    label: "Ana Torres",
    description: "Perfil de LinkedIn",
    metadata: "Perfil autorizado",
  },
  x_profile: {
    id: "x-profile-ana",
    label: "@anatorres",
    description: "Perfil de X",
    metadata: "Perfil autorizado con PKCE",
  },
  tiktok_profile: {
    id: "tt-profile-ana",
    label: "@anatorres.creates",
    description: "Perfil de TikTok",
    metadata: "Cuenta de creator",
  },
}

export const mockWhatsAppDevices = {
  initial: "wa-device-demo-01",
  retry: "wa-device-demo-02",
  reconnect: "wa-device-demo-03",
} as const
