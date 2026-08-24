import { AdminLanguageTranslationsPage } from "@/features/admin-languages/components/admin-language-translations-page"

type AdminLanguageTranslationsRouteProps = {
  params: Promise<{ code: string }>
}

export default async function AdminLanguageTranslationsRoutePage({
  params,
}: AdminLanguageTranslationsRouteProps) {
  const { code } = await params
  return <AdminLanguageTranslationsPage code={code} />
}
