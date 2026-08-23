import { z } from "zod"

/**
 * Idiomas que la plataforma sabe mostrar. Vive aparte de `index.ts` porque lo
 * usan contratos que este reexporta: importarlo desde ahí crearía un ciclo.
 */
export const supportedLocaleSchema = z.enum(["es", "en"])

export type SupportedLocale = z.infer<typeof supportedLocaleSchema>
