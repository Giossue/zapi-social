import type { SupportedLocale } from "@workspace/contracts"

export const defaultLocale = "es" satisfies SupportedLocale

export const supportedLocales = [
  "es",
  "en",
] as const satisfies readonly SupportedLocale[]

export const localeCookieName = "zapi_locale"

export const localeCookieMaxAge = 60 * 60 * 24 * 365

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale)
}

export function resolveLocale(value: unknown): SupportedLocale {
  return isSupportedLocale(value) ? value : defaultLocale
}
