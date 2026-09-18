"use client"

import type { ReactNode } from "react"
import type { PortalAuthSession } from "@workspace/contracts"

import { AppShell } from "@/components/app-shell"
import { AreaAccessGate } from "@/features/identity/components/area-access-gate"

type PortalAreaLayoutProps = {
  children: ReactNode
}

export function PortalAreaLayout({ children }: PortalAreaLayoutProps) {
  return (
    <AreaAccessGate
      area="portal"
      childrenAction={(session) => (
        <AppShell session={session as PortalAuthSession | null}>
          {children}
        </AppShell>
      )}
    />
  )
}
