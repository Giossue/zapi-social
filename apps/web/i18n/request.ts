import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { localeCookieName, resolveLocale } from "./locales"

/**
 * El idioma se resuelve desde la cookie `zapi_locale` y cae al idioma por
 * defecto cuando falta o no está soportado. La cookie la escribe el cliente al
 * cambiar el idioma en el perfil y al sincronizar `users.locale` de la sesión,
 * de modo que el render no depende de una llamada a la API por petición.
 */
export default getRequestConfig(async () => {
  const store = await cookies()
  const locale = resolveLocale(store.get(localeCookieName)?.value)

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    formats,
  }
})

/**
 * Formatos con nombre: las pantallas piden `format.dateTime(value, "date")` en
 * vez de repetir opciones de `Intl` y un idioma fijo en cada feature.
 */
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
