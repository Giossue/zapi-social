"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { DashboardShell } from "@/components/dashboard-shell/dashboard-shell"
import { useTranslatedNavigation } from "@/components/dashboard-shell/translate-navigation"
import {
  adminNavigationGroups,
  isAdminNavigationItemActive,
} from "@/features/platform-admin/admin-navigation"

type AdminShellProps = {
  children: React.ReactNode
  profile: { displayName: string; email: string }
}

export function AdminShell({ children, profile }: AdminShellProps) {
  const t = useTranslations("shell")
  const items = useTranslatedNavigation(
    adminNavigationGroups,
    "navigation.admin"
  )
  const documentTitleOverrides = useMemo(
    () => ({ "/admin/profile": t("profile") }),
    [t]
  )

  return (
    <DashboardShell
      areaName="Admin"
      documentTitleOverrides={documentTitleOverrides}
      homeHref="/admin/dashboard"
      isItemActive={(item, pathname) =>
        isAdminNavigationItemActive(item.href, pathname)
      }
      items={items}
      navigationLabel={t("adminNavigationLabel")}
      profile={profile}
      sidebarStorageKey="zapi:admin-sidebar:v1"
    >
      {children}
    </DashboardShell>
  )
}
