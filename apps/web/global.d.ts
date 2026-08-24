import type messages from "../../packages/contracts/src/messages/es.d.json"
import type { formats } from "./i18n/request"

/**
 * Tipa claves, argumentos y formatos a partir del idioma fuente: una clave que
 * no exista en `messages/es.json` falla en typecheck en vez de renderizarse
 * como texto crudo.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: string
    Messages: typeof messages
    Formats: typeof formats
  }
}
