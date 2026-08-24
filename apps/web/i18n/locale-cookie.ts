"use client"

import { isLocaleCode, localeCookieMaxAge, localeCookieName } from "./locales"

export function readLocaleCookie(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${localeCookieName}=`))
  const value = match?.slice(localeCookieName.length + 1)
  return isLocaleCode(value) ? value : null
}

export function writeLocaleCookie(locale: string) {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${localeCookieName}=${locale}; Path=/; Max-Age=${localeCookieMaxAge}; SameSite=Lax${secure}`
}

export function syncLocaleCookie(locale: string | null): boolean {
  if (!locale || !isLocaleCode(locale) || readLocaleCookie() === locale)
    return false
  writeLocaleCookie(locale)
  return true
}
