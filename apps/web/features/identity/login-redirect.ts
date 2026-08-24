const AREA_PREFIXES = ["/portal", "/admin"] as const

export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith("/") || value.startsWith("//")) return null
  if (value.includes("://") || value.includes("\\")) return null
  const path = value.split("?")[0] ?? ""
  const allowed = AREA_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
  return allowed ? value : null
}

function currentPath(): string | null {
  if (typeof window === "undefined") return null
  return `${window.location.pathname}${window.location.search}`
}

export function loginPath(destination?: string | null): string {
  const target = safeNextPath(destination ?? currentPath())
  return target ? `/login?next=${encodeURIComponent(target)}` : "/login"
}
