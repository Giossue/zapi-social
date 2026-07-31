"use client"

import type { ReactNode } from "react"

import { AppShell } from "@/components/app-shell"
import { AreaAccessGate } from "@/features/identity/components/area-access-gate"

type PortalAreaLayoutProps = {
  children: ReactNode
}

export function PortalAreaLayout({ children }: PortalAreaLayoutProps) {
  return (
    <AreaAccessGate area="portal">
      {(session) => <AppShell profile={session.user}>{children}</AppShell>}
    </AreaAccessGate>
  )
}
