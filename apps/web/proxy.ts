import { type NextRequest, NextResponse } from "next/server"

const sessionCookieName = "zapi_session"

/**
 * Guard rápido de navegación: evita renderizar áreas protegidas si no existe
 * una sesión. Nest mantiene la verificación autoritativa de revocación y roles.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(sessionCookieName)) return NextResponse.next()

  const loginUrl = new URL("/login", request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
}
