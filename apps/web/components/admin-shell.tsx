"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { DashboardShell } from "@/components/dashboard-shell/dashboard-shell"
import { PageLoading } from "@/components/page-loading"
import { useTranslatedNavigation } from "@/components/dashboard-shell/translate-navigation"
import {
  adminNavigationGroups,
  isAdminNavigationItemActive,
} from "@/features/platform-admin/admin-navigation"
import {
  IntegrationsNavigationProvider,
  IntegrationsSidebar,
} from "@/features/integrations/components/integrations-navigation-context"

type AdminShellProps = {
  children: React.ReactNode
  profile?: { displayName: string; email: string }
}

export function AdminShell({ children, profile }: AdminShellProps) {
  const t = useTranslations("shell")
  const pathname = usePathname()
  const integrationsActive = Boolean(
    profile && pathname === "/admin/integrations"
  )
  const items = useTranslatedNavigation(
    adminNavigationGroups,
    "navigation.admin"
  )
  const documentTitleOverrides = useMemo(
    () => ({ "/admin/profile": t("profile") }),
    [t]
  )

  return (
    <IntegrationsNavigationProvider enabled={integrationsActive}>
      <DashboardShell
        areaName="Admin"
        documentTitleOverrides={documentTitleOverrides}
        homeHref="/admin/dashboard"
        isItemActive={(item, pathname) =>
          isAdminNavigationItemActive(item.href, pathname)
        }
        items={items}
        navigationLabel={t("adminNavigationLabel")}
        loading={!profile}
        profile={profile}
        secondaryNavigation={
          integrationsActive ? <IntegrationsSidebar /> : undefined
        }
        sidebarStorageKey="zapi:admin-sidebar:v1"
      >
        {profile ? (
          children
        ) : (
          <PageLoading className="min-h-[calc(100dvh-3rem)]" />
        )}
      </DashboardShell>
    </IntegrationsNavigationProvider>
  )
}
