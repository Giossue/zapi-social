import { type NextRequest, NextResponse } from "next/server"

import { safeNextPath } from "@/features/identity/login-redirect"

const sessionCookieName = "zapi_session"
const accessCookieName = "zapi_access"
const apiOrigin = process.env.INTERNAL_API_ORIGIN ?? "http://127.0.0.1:3001"

const authRoutes = ["/login", "/register"]

async function isSessionAlive(request: NextRequest): Promise<boolean> {
  try {
    const response = await fetch(`${apiOrigin}/v1/auth/session`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    })
    return response.ok
  } catch {
    return false
  }
}

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
    const response = NextResponse.next()
    response.cookies.delete(sessionCookieName)
    response.cookies.delete(accessCookieName)
    return response
  }

  if (hasSession) return NextResponse.next()

  const loginUrl = new URL("/login", request.url)
  const next = safeNextPath(`${pathname}${search}`)
  if (next) loginUrl.searchParams.set("next", next)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/login", "/register"],
}
