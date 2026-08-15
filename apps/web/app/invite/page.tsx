import type { Metadata } from "next"

import { InvitationPage } from "@/features/teams/components/invitation-page"

export const metadata: Metadata = {
  title: "Invitación - Zapi Social",
}

export default function InviteRoute() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 sm:px-6">
      <InvitationPage />
    </main>
  )
}
