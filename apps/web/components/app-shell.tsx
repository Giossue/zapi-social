"use client"

import type { PortalAuthSession } from "@workspace/contracts"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { DashboardShell } from "@/components/dashboard-shell/dashboard-shell"
import { useTranslatedNavigation } from "@/components/dashboard-shell/translate-navigation"
import {
  isPortalNavigationItemActive,
  portalNavigationGroups,
} from "@/features/portal-shell/portal-navigation"

type AppShellProps = {
  children: React.ReactNode
  session: PortalAuthSession
}

export function AppShell({ children, session }: AppShellProps) {
  const t = useTranslations("shell")
  const items = useTranslatedNavigation(
    portalNavigationGroups,
    "navigation.portal"
  )
  const workspaces = session.workspaces?.length
    ? session.workspaces
    : [session.workspace]

  const documentTitleOverrides = useMemo(
    () => ({
      "/portal/profile": t("profile"),
      "/portal/ai-studio/prompt-history": t("promptHistory"),
    }),
    [t]
  )

  return (
    <DashboardShell
      areaName="Portal"
      documentTitleOverrides={documentTitleOverrides}
      homeHref="/portal/dashboard"
      isItemActive={(item, pathname) =>
        isPortalNavigationItemActive(item.href, pathname)
      }
      items={items}
      navigationLabel={t("portalNavigationLabel")}
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
