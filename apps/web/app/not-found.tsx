import Link from "next/link"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"

import { Button } from "@workspace/ui/components/button"

const sessionCookieName = "zapi_session"

/** Sin sesión el destino útil es el acceso, no un panel que rebotaría. */
export default async function NotFound() {
  const t = await getTranslations("routeStates")
  const store = await cookies()
  const destination = store.has(sessionCookieName)
    ? "/portal/dashboard"
    : "/login"

  return (
    <div className="flex h-dvh flex-col items-center justify-center space-y-2 text-center">
      <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-muted-foreground">{t("notFound.description")}</p>
      <Link replace href={destination}>
        <Button variant="brand-secondary">{t("notFound.back")}</Button>
      </Link>
    </div>
  )
}
