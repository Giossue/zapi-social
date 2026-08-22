import { type NextRequest, NextResponse } from "next/server"

import { safeNextPath } from "@/features/identity/login-redirect"

const sessionCookieName = "zapi_session"

/**
 * Guard rápido de navegación: evita renderizar áreas protegidas si no existe
 * una sesión. Nest mantiene la verificación autoritativa de revocación y roles.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(sessionCookieName)) return NextResponse.next()

  const loginUrl = new URL("/login", request.url)
  // La persona vuelve a donde iba en lugar de aterrizar siempre en el panel.
  const destination = `${request.nextUrl.pathname}${request.nextUrl.search}`
  const next = safeNextPath(destination)
  if (next) loginUrl.searchParams.set("next", next)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
}
