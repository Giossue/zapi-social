"use client"

import { useTranslations } from "next-intl"

const providerNames: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  meta: "Meta",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  "whatsapp-status": "WhatsApp Status",
  x: "X",
}

export function useDashboardLabels() {
  const t = useTranslations("dashboard.labels")

  return {
    provider(key: string) {
      if (key === "none") return t("noChannel")
      return providerNames[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
    },
    aiKind(key: string) {
      const messageKey = `aiKind.${key}` as Parameters<typeof t>[0]
      return t.has(messageKey) ? t(messageKey) : key
    },
  }
}
