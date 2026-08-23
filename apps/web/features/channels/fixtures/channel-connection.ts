import {
  BrandFacebook,
  BrandInstagram,
  BrandLinkedIn,
  BrandTikTok,
  BrandX,
  BrandWhatsApp,
} from "@/components/brand-icons"
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
      label: "Página de Facebook",
      description: "Selecciona una página de Facebook que administras.",
      icon: BrandFacebook,
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
      label: "Perfil de Instagram",
      description: "Selecciona un perfil profesional de Instagram vinculado.",
      icon: BrandInstagram,
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
      label: "Página de LinkedIn",
      description: "Elige una organización que administras en LinkedIn.",
      icon: BrandLinkedIn,
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
      label: "Perfil de LinkedIn",
      description: "Conecta directamente el perfil que autorices en LinkedIn.",
      icon: BrandLinkedIn,
      flow: "oauth-direct",
    },
    {
      key: "x_profile",
      provider: "x",
      label: "Perfil de X",
      description: "Autoriza un perfil de X mediante OAuth 2.0 con PKCE.",
      icon: BrandX,
      flow: "pkce-direct",
    },
    {
      key: "tiktok_profile",
      provider: "tiktok",
      label: "Perfil de TikTok",
      description:
        "Autoriza un perfil y revisa la información pública del creador.",
      icon: BrandTikTok,
      flow: "creator-info",
    },
    {
      key: "whatsapp_status",
      provider: "whatsapp",
      label: "Historias de WhatsApp",
      description: "Vincula un dispositivo escaneando un QR desde WhatsApp.",
      icon: BrandWhatsApp,
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
    metadata: "Cuenta de creador",
  },
}

export const mockWhatsAppDevices = {
  initial: "wa-device-demo-01",
  retry: "wa-device-demo-02",
  reconnect: "wa-device-demo-03",
} as const
