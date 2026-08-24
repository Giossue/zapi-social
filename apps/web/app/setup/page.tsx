import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthShell } from "@/features/identity/components/auth-page"
import { SetupForm } from "@/features/setup/components/setup-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("setup")
  return { title: t("metadata") }
}

export default function SetupPage() {
  return (
    <AuthShell>
      <SetupForm />
    </AuthShell>
  )
}
