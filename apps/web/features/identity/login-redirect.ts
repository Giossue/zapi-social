/**
 * Destino de vuelta tras iniciar sesión.
 *
 * Sin esto cada pantalla mandaba a `/login` a secas y la persona reaparecía en
 * el panel, perdiendo la página en la que estaba trabajando. El destino viaja
 * en `?next=` y se valida siempre: solo se acepta una ruta relativa propia bajo
 * `/portal` o `/admin`, de modo que un enlace manipulado no pueda usar el login
 * para enviar a un sitio ajeno.
 */

const AREA_PREFIXES = ["/portal", "/admin"] as const

export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null
  // Una barra doble o un esquema convierten la ruta en absoluta hacia otro host.
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

/** Ruta de login que recuerda dónde estaba la persona. */
export function loginPath(destination?: string | null): string {
  const target = safeNextPath(destination ?? currentPath())
  return target ? `/login?next=${encodeURIComponent(target)}` : "/login"
}
