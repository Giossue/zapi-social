import type sourceMessages from "../../../packages/contracts/src/messages/es.d.json"
import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { fetchActiveLanguages, messagesFor } from "./dynamic-messages"
import { defaultLocale, isLocaleCode, localeCookieName } from "./locales"

export default getRequestConfig(async () => {
  const store = await cookies()
  const requested = store.get(localeCookieName)?.value
  const languages = await fetchActiveLanguages()
  const fallback =
    languages.find((language) => language.isDefault)?.code ?? defaultLocale
  const locale =
    isLocaleCode(requested) &&
    languages.some((language) => language.code === requested)
      ? requested
      : fallback

  return {
    locale,
    messages: (await messagesFor(locale)) as unknown as typeof sourceMessages,
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
