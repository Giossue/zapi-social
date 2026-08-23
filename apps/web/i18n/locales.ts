import type { SupportedLocale } from "@workspace/contracts"

/**
 * Español es el idioma fuente: los textos se escriben primero en `es.json` y
 * el resto de idiomas traduce esas mismas claves.
 */
export const defaultLocale = "es" satisfies SupportedLocale

export const supportedLocales = [
  "es",
  "en",
] as const satisfies readonly SupportedLocale[]

/** Cookie legible por el servidor; no guarda datos de sesión, solo el idioma. */
export const localeCookieName = "zapi_locale"

export const localeCookieMaxAge = 60 * 60 * 24 * 365

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale)
}

/** Un valor desconocido o ausente cae al idioma por defecto. */
export function resolveLocale(value: unknown): SupportedLocale {
  return isSupportedLocale(value) ? value : defaultLocale
}
