import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const sessionCookieName = "zapi_session"

/**
 * La raíz resuelve por estado de acceso: quien ya tiene sesión no debería pasar
 * por el login. El área concreta la decide el propio panel, que sí conoce la
 * sesión; aquí basta con no expulsar a quien ya entró.
 */
export default async function HomePage() {
  const store = await cookies()
  redirect(store.has(sessionCookieName) ? "/portal/dashboard" : "/login")
}
