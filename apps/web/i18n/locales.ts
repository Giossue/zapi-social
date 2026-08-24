import { localeCodeSchema } from "@workspace/contracts"

export const defaultLocale = "es"

export const localeCookieName = "zapi_locale"

export const localeCookieMaxAge = 60 * 60 * 24 * 365

export function isLocaleCode(value: unknown): value is string {
  return localeCodeSchema.safeParse(value).success
}
