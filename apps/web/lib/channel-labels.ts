"use client"

import { useTranslations } from "next-intl"

const providerNames = {
  meta: "Meta",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  whatsapp: "Meta",
} as const

export type ChannelProvider = keyof typeof providerNames

export const capabilityKeys = [
  "facebook_page",
  "instagram_profile",
  "linkedin_page",
  "linkedin_profile",
  "x_profile",
  "tiktok_profile",
  "whatsapp_status",
] as const

export type ChannelCapabilityKey = (typeof capabilityKeys)[number]

function isCapabilityKey(value: string): value is ChannelCapabilityKey {
  return (capabilityKeys as readonly string[]).includes(value)
}

export function useChannelLabels() {
  const t = useTranslations("channels.capability")

  return {
    capability(key: string) {
      return isCapabilityKey(key) ? t(key) : key
    },
    provider(provider: ChannelProvider) {
      return providerNames[provider] ?? provider
    },
  }
}
