"use client"

import type { ReactNode } from "react"

import { AdminShell } from "@/components/admin-shell"
import { AreaAccessGate } from "@/features/identity/components/area-access-gate"

type AdminAreaLayoutProps = {
  children: ReactNode
}

export function AdminAreaLayout({ children }: AdminAreaLayoutProps) {
  return (
    <AreaAccessGate area="admin">
      {(session) => <AdminShell profile={session.user}>{children}</AdminShell>}
    </AreaAccessGate>
  )
}
