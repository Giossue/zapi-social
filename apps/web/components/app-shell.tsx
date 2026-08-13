"use client"

import type { PortalAuthSession } from "@workspace/contracts"

import { DashboardShell } from "@/components/dashboard-shell/dashboard-shell"
import {
  isPortalNavigationItemActive,
  portalNavigationGroups,
  type PortalNavigationLink,
} from "@/features/portal-shell/portal-navigation"

type AppShellProps = {
  children: React.ReactNode
  session: PortalAuthSession
}

export function AppShell({ children, session }: AppShellProps) {
  const workspaces = session.workspaces?.length
    ? session.workspaces
    : [session.workspace]

  return (
    <DashboardShell
      homeHref="/portal/dashboard"
      isItemActive={(item, pathname) =>
        isPortalNavigationItemActive(item as PortalNavigationLink, pathname)
      }
      items={portalNavigationGroups}
      navigationLabel="Navegación principal del portal"
      profile={session.user}
      sidebarStorageKey="zapi:portal-sidebar:v1"
      workspaceContext={{
        activeWorkspace: session.workspace,
        workspaces,
      }}
    >
      {children}
    </DashboardShell>
  )
}
