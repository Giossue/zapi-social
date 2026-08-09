import { AuthPage } from "@/features/identity/components/auth-page"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams
  return (
    <AuthPage
      initialMode="login"
      returnTo={returnTo === "/invite" ? "/invite" : undefined}
    />
  )
}
