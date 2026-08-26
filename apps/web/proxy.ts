import { type NextRequest, NextResponse } from "next/server"

import { safeNextPath } from "@/features/identity/login-redirect"

const sessionCookieName = "zapi_session"
const accessCookieName = "zapi_access"
const apiOrigin = process.env.INTERNAL_API_ORIGIN ?? "http://127.0.0.1:3001"
const portalHost = process.env.PORTAL_HOST

const authRoutes = ["/login", "/register"]

async function setupRequired(): Promise<boolean | null> {
  try {
    const response = await fetch(`${apiOrigin}/v1/setup`, { cache: "no-store" })
    if (!response.ok) return null
    const status = (await response.json()) as { needsSetup?: boolean }
    return status.needsSetup === true
  } catch {
    return null
  }
}

async function sessionArea(
  request: NextRequest
): Promise<"admin" | "portal" | null> {
  try {
    const response = await fetch(`${apiOrigin}/v1/auth/session`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    })
    if (!response.ok) return null
    const session = (await response.json()) as { area?: string }
    return session.area === "admin" || session.area === "portal"
      ? session.area
      : null
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(sessionCookieName)
  const { pathname, search } = request.nextUrl

  if (pathname === "/") {
    const host = request.headers.get("host")?.split(":")[0]
    if (!portalHost || host !== portalHost) return NextResponse.next()
    if ((await setupRequired()) === true) {
      return NextResponse.redirect(new URL("/setup", request.url))
    }
    const area = hasSession ? await sessionArea(request) : null
    return NextResponse.redirect(
      new URL(area ? `/${area}/dashboard` : "/login", request.url)
    )
  }

  if (pathname === "/setup") {
    const required = await setupRequired()
    if (required !== false) return NextResponse.next()
    const area = hasSession ? await sessionArea(request) : null
    return NextResponse.redirect(
      new URL(area ? `/${area}/dashboard` : "/login", request.url)
    )
  }

  if (authRoutes.includes(pathname)) {
    if ((await setupRequired()) === true) {
      return NextResponse.redirect(new URL("/setup", request.url))
    }
    if (!hasSession) return NextResponse.next()
    const area = await sessionArea(request)
    if (area) {
      const next = safeNextPath(request.nextUrl.searchParams.get("next"))
      return NextResponse.redirect(
        new URL(next ?? `/${area}/dashboard`, request.url)
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
  matcher: [
    "/",
    "/admin/:path*",
    "/portal/:path*",
    "/login",
    "/register",
    "/setup",
  ],
}
