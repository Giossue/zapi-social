import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthPage } from "@/features/identity/components/auth-page"
import { safeNextPath } from "@/features/identity/login-redirect"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.metadata")
  return { title: t("login") }
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
