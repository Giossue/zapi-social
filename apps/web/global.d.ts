import type messages from "./messages/es.d.json"
import type { formats } from "./i18n/request"
import type { supportedLocales } from "./i18n/locales"

/**
 * Tipa claves, argumentos y formatos a partir del idioma fuente: una clave que
 * no exista en `messages/es.json` falla en typecheck en vez de renderizarse
 * como texto crudo.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof supportedLocales)[number]
    Messages: typeof messages
    Formats: typeof formats
  }
}
