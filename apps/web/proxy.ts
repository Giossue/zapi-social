import { type NextRequest, NextResponse } from "next/server"

import { safeNextPath } from "@/features/identity/login-redirect"

const sessionCookieName = "zapi_session"
const accessCookieName = "zapi_access"
const apiOrigin = process.env.INTERNAL_API_ORIGIN ?? "http://127.0.0.1:3001"

/** Páginas de acceso: no tienen sentido para quien ya inició sesión. */
const authRoutes = ["/login", "/register"]

/**
 * Una cookie presente no garantiza una sesión viva: puede quedar huérfana si
 * el cierre de sesión no logró borrarla o si la sesión fue revocada en el
 * servidor. Solo las rutas de acceso pagan esta verificación; sin ella, el
 * guard rebota /login → panel → 401 → /login en un bucle infinito.
 */
async function isSessionAlive(request: NextRequest): Promise<boolean> {
  try {
    const response = await fetch(`${apiOrigin}/v1/auth/session`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    })
    return response.ok
  } catch {
    // Sin API alcanzable se muestra el formulario: es el destino seguro.
    return false
  }
}

/**
 * Guard rápido de navegación en las dos direcciones: evita renderizar un área
 * protegida sin sesión, y evita mostrar el formulario de acceso a quien ya la
 * tiene. Nest mantiene la verificación autoritativa de revocación y roles; el
 * área concreta la corrige el gate de cliente si la sesión no es de Portal.
 */
export async function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(sessionCookieName)
  const { pathname, search } = request.nextUrl

  if (authRoutes.includes(pathname)) {
    if (!hasSession) return NextResponse.next()
    if (await isSessionAlive(request)) {
      const next = safeNextPath(request.nextUrl.searchParams.get("next"))
      return NextResponse.redirect(
        new URL(next ?? "/portal/dashboard", request.url)
      )
    }
    // Cookie huérfana: se elimina aquí para que el rebote no pueda repetirse.
    const response = NextResponse.next()
    response.cookies.delete(sessionCookieName)
    response.cookies.delete(accessCookieName)
    return response
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
