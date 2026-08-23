"use client"

import { useTranslations } from "next-intl"

/**
 * Los nombres de proveedor son marcas y no se traducen; solo la ausencia de
 * canal tiene texto propio. La API envía la clave y aquí se rotula.
 */
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
    /** `none` es la publicación sin canal asociado. */
    provider(key: string) {
      if (key === "none") return t("noChannel")
      return providerNames[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
    },
    /** Los tipos de uso de AI mezclan nombre propio y término traducible. */
    aiKind(key: string) {
      const messageKey = `aiKind.${key}` as Parameters<typeof t>[0]
      return t.has(messageKey) ? t(messageKey) : key
    },
  }
}
