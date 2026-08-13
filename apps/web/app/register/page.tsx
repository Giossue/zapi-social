import type { Metadata } from "next"

import { AuthPage } from "@/features/identity/components/auth-page"

export const metadata: Metadata = {
  title: "Crear cuenta | Zapi Social",
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
