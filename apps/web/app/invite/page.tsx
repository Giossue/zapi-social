import { getBrandName } from "@/lib/branding"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { InvitationPage } from "@/features/teams/components/invitation-page"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")
  const brand = await getBrandName()
  return { title: t("invite", { brand }) }
}

export default function InviteRoute() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 sm:px-6">
      <InvitationPage />
    </main>
  )
}
