import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const sessionCookieName = "zapi_session"

export default async function HomePage() {
  const store = await cookies()
  redirect(store.has(sessionCookieName) ? "/portal/dashboard" : "/login")
}
