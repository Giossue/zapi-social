"use client"

import { useTranslations } from "next-intl"

/**
 * La API responde códigos estables (`AUTH_SESSION_EXPIRED`) y la interfaz los
 * traduce. Este hook es el único diccionario: un código sin texto propio cae
 * al mensaje genérico en vez de mostrarse crudo.
 */
export function useApiErrorMessage() {
  const t = useTranslations("errors")

  return function apiErrorMessage(code?: string) {
    if (!code) return t("generic")
    const key = code as Parameters<typeof t>[0]
    return t.has(key) ? t(key) : t("generic")
  }
}
