import Link from "next/link"
import { cookies } from "next/headers"

import { Button } from "@workspace/ui/components/button"

const sessionCookieName = "zapi_session"

/** Sin sesión el destino útil es el acceso, no un panel que rebotaría. */
export default async function NotFound() {
  const store = await cookies()
  const destination = store.has(sessionCookieName)
    ? "/portal/dashboard"
    : "/login"

  return (
    <div className="flex h-dvh flex-col items-center justify-center space-y-2 text-center">
      <h1 className="font-semibold text-2xl">No encontramos esta página</h1>
      <p className="text-muted-foreground">
        Es posible que el enlace haya cambiado o que ya no exista.
      </p>
      <Link replace href={destination}>
        <Button variant="brand-secondary">Volver</Button>
      </Link>
    </div>
  )
}
