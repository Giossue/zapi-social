import { type NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const apiOrigin = process.env.INTERNAL_API_ORIGIN ?? "http://127.0.0.1:3001"

async function proxy(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const targetUrl = new URL(
    requestUrl.pathname.replace(/^\/api/, "") + requestUrl.search,
    apiOrigin
  )
  const headers = new Headers(request.headers)
  headers.delete("host")
  headers.delete("content-length")

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    cache: "no-store",
  }

  if (hasBody) init.duplex = "half"

  const response = await fetch(targetUrl, init)

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  })
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const PUT = proxy
export const DELETE = proxy
export const HEAD = proxy
