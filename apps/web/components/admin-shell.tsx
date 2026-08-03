"use client"

import { DashboardShell } from "@/components/dashboard-shell/dashboard-shell"
import {
  adminNavigationGroups,
  isAdminNavigationItemActive,
  type AdminNavigationLink,
} from "@/features/platform-admin/admin-navigation"

type AdminShellProps = {
  children: React.ReactNode
  profile: { displayName: string; email: string }
}

export function AdminShell({ children, profile }: AdminShellProps) {
  return (
    <DashboardShell
      areaLabel="Plataforma"
      homeHref="/admin/dashboard"
      isItemActive={(item, pathname) =>
        isAdminNavigationItemActive(item as AdminNavigationLink, pathname)
      }
      items={adminNavigationGroups}
      navigationLabel="Navegación principal de la plataforma"
      profile={profile}
      sidebarStorageKey="zapi:admin-sidebar:v1"
    >
      {children}
    </DashboardShell>
  )
}
