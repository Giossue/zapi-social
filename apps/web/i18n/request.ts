import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { localeCookieName, resolveLocale } from "./locales"

export default getRequestConfig(async () => {
  const store = await cookies()
  const locale = resolveLocale(store.get(localeCookieName)?.value)

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    formats,
  }
})

export const formats = {
  dateTime: {
    date: { day: "numeric", month: "short", year: "numeric" },
    dateTime: {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    time: { hour: "2-digit", minute: "2-digit" },
  },
} as const
