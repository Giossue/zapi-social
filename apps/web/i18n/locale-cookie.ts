"use client"

import type { SupportedLocale } from "@workspace/contracts"

import {
  isSupportedLocale,
  localeCookieMaxAge,
  localeCookieName,
} from "./locales"

/**
 * El idioma se guarda en una cookie legible por el servidor para que el render
 * no dependa de una llamada a la API. No es un secreto: solo indica en qué
 * idioma se muestra la interfaz.
 */
export function readLocaleCookie(): SupportedLocale | null {
  if (typeof document === "undefined") return null
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${localeCookieName}=`))
  const value = match?.slice(localeCookieName.length + 1)
  return isSupportedLocale(value) ? value : null
}

export function writeLocaleCookie(locale: SupportedLocale) {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${localeCookieName}=${locale}; Path=/; Max-Age=${localeCookieMaxAge}; SameSite=Lax${secure}`
}

/**
 * Alinea la cookie con el idioma del usuario. Devuelve `true` cuando el idioma
 * mostrado cambia, para que quien llama refresque la vista.
 */
export function syncLocaleCookie(locale: SupportedLocale | null): boolean {
  if (!locale || readLocaleCookie() === locale) return false
  writeLocaleCookie(locale)
  return true
}
