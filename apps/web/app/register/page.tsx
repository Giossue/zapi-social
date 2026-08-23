import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthPage } from "@/features/identity/components/auth-page"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.metadata")
  return { title: t("register") }
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams
  return (
    <AuthPage
      initialMode="register"
      returnTo={returnTo === "/invite" ? "/invite" : undefined}
    />
  )
}
