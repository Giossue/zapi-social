import type { Metadata } from "next"

import { AuthPage } from "@/features/identity/components/auth-page"
import { safeNextPath } from "@/features/identity/login-redirect"

export const metadata: Metadata = {
  title: "Iniciar sesión - Zapi Social",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; next?: string }>
}) {
  const { returnTo, next } = await searchParams
  return (
    <AuthPage
      initialMode="login"
      returnTo={
        returnTo === "/invite" ? "/invite" : (safeNextPath(next) ?? undefined)
      }
    />
  )
}
