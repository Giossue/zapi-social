import { type NextRequest, NextResponse } from "next/server"

import { safeNextPath } from "@/features/identity/login-redirect"

const sessionCookieName = "zapi_session"

/** Páginas de acceso: no tienen sentido para quien ya inició sesión. */
const authRoutes = ["/login", "/register"]

/**
 * Guard rápido de navegación en las dos direcciones: evita renderizar un área
 * protegida sin sesión, y evita mostrar el formulario de acceso a quien ya la
 * tiene. Nest mantiene la verificación autoritativa de revocación y roles; el
 * área concreta la corrige el gate de cliente si la sesión no es de Portal.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(sessionCookieName)
  const { pathname, search } = request.nextUrl

  if (authRoutes.includes(pathname)) {
    if (!hasSession) return NextResponse.next()
    const next = safeNextPath(request.nextUrl.searchParams.get("next"))
    return NextResponse.redirect(new URL(next ?? "/portal/dashboard", request.url))
  }

  if (hasSession) return NextResponse.next()

  const loginUrl = new URL("/login", request.url)
  // La persona vuelve a donde iba en lugar de aterrizar siempre en el panel.
  const next = safeNextPath(`${pathname}${search}`)
  if (next) loginUrl.searchParams.set("next", next)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/login", "/register"],
}
