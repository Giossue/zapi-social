"use client"

import { DashboardShell } from "@/components/dashboard-shell/dashboard-shell"
import {
  isPortalNavigationItemActive,
  portalNavigationGroups,
  type PortalNavigationLink,
} from "@/features/portal-shell/portal-navigation"

type AppShellProps = {
  children: React.ReactNode
  profile: {
    displayName: string
    email: string
  }
}

export function AppShell({ children, profile }: AppShellProps) {
  return (
    <DashboardShell
      areaLabel="Portal"
      homeHref="/portal/dashboard"
      isItemActive={(item, pathname) =>
        isPortalNavigationItemActive(item as PortalNavigationLink, pathname)
      }
      items={portalNavigationGroups}
      navigationLabel="Navegación principal del portal"
      profile={profile}
      sidebarStorageKey="zapi:portal-sidebar:v1"
    >
      {children}
    </DashboardShell>
  )
}
