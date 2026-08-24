import { z } from "zod"

export const supportedLocaleSchema = z.enum(["es", "en"])

export type SupportedLocale = z.infer<typeof supportedLocaleSchema>
