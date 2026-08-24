import en from "./messages/en.json" with { type: "json" }
import es from "./messages/es.json" with { type: "json" }

export const messageCatalogs = { es, en } as const

export type MessageCatalogLocale = keyof typeof messageCatalogs

export function flattenMessages(
  node: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const flat: Record<string, string> = {}
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") {
      flat[path] = value
    } else if (value && typeof value === "object") {
      Object.assign(
        flat,
        flattenMessages(value as Record<string, unknown>, path)
      )
    }
  }
  return flat
}
