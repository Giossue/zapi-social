import { messageCatalogs } from "@workspace/contracts"

const apiOrigin = process.env.INTERNAL_API_ORIGIN ?? "http://127.0.0.1:3001"

type ActiveLanguage = {
  code: string
  isDefault: boolean
}

const fallbackLanguages: ActiveLanguage[] = [
  { code: "es", isDefault: true },
  { code: "en", isDefault: false },
]

export async function fetchActiveLanguages(): Promise<ActiveLanguage[]> {
  try {
    const response = await fetch(`${apiOrigin}/v1/i18n/languages`, {
      next: { revalidate: 300 },
    })
    if (!response.ok) return fallbackLanguages
    const body = (await response.json()) as {
      languages?: { code?: string; isDefault?: boolean }[]
    }
    const languages = (body.languages ?? [])
      .filter((language) => typeof language.code === "string")
      .map((language) => ({
        code: language.code!,
        isDefault: language.isDefault === true,
      }))
    return languages.length ? languages : fallbackLanguages
  } catch {
    return fallbackLanguages
  }
}

async function fetchOverrides(locale: string): Promise<string> {
  try {
    const response = await fetch(
      `${apiOrigin}/v1/i18n/messages/${encodeURIComponent(locale)}`,
      { next: { revalidate: 60 } }
    )
    if (!response.ok) return "{}"
    const body = (await response.json()) as {
      messages?: Record<string, string>
    }
    return JSON.stringify(body.messages ?? {})
  } catch {
    return "{}"
  }
}

type CatalogNode = { [key: string]: string | CatalogNode }

function applyOverride(target: CatalogNode, path: string[], value: string) {
  const [head, ...rest] = path
  if (!head) return
  if (!rest.length) {
    if (typeof target[head] === "string") target[head] = value
    return
  }
  const child = target[head]
  if (typeof child !== "object" || child === null) return
  applyOverride(child, rest, value)
}

const mergedCache = new Map<
  string,
  { overrides: string; merged: CatalogNode }
>()

export async function messagesFor(locale: string): Promise<CatalogNode> {
  const base = locale === "en" ? messageCatalogs.en : messageCatalogs.es
  const overrides = await fetchOverrides(locale)
  const cached = mergedCache.get(locale)
  if (cached && cached.overrides === overrides) return cached.merged
  const merged = structuredClone(base) as unknown as CatalogNode
  const entries = Object.entries(
    JSON.parse(overrides) as Record<string, string>
  )
  for (const [key, value] of entries) {
    applyOverride(merged, key.split("."), value)
  }
  mergedCache.set(locale, { overrides, merged })
  return merged
}
