"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"

export function useApiErrorMessage() {
  const t = useTranslations("errors")

  return useCallback(
    (code?: string) => {
      if (!code) return t("generic")
      const key = code as Parameters<typeof t>[0]
      return t.has(key) ? t(key) : t("generic")
    },
    [t]
  )
}
