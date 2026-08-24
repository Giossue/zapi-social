"use client"

import { portalModuleForHref } from "@workspace/contracts"
import type { PortalAuthSession } from "@workspace/contracts"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { DashboardShell } from "@/components/dashboard-shell/dashboard-shell"
import type {
  DashboardNavigationGroup,
  DashboardNavigationItem,
} from "@/components/dashboard-shell/navigation-types"
import { ImpersonationBanner } from "@/features/identity/components/impersonation-banner"
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
  const translated = useTranslatedNavigation(
    portalNavigationGroups,
    "navigation.portal"
  )
  const enabledModules = session.enabledModules
  const items = useMemo(() => {
    if (!enabledModules) return translated
    return translated
      .map((group): DashboardNavigationGroup => {
        const items = group.items.flatMap((item): DashboardNavigationItem[] => {
          if ("children" in item) {
            const children = item.children.filter((child) => {
              const moduleKey = portalModuleForHref(child.href)
              return !moduleKey || enabledModules.includes(moduleKey)
            })
            return children.length ? [{ ...item, children }] : []
          }
          const moduleKey = portalModuleForHref(item.href)
          return !moduleKey || enabledModules.includes(moduleKey) ? [item] : []
        })
        return { ...group, items }
      })
      .filter((group) => group.items.length)
  }, [enabledModules, translated])
  const workspaces = session.workspaces?.length
    ? session.workspaces
    : [session.workspace]

  const documentTitleOverrides = useMemo(
    () => ({
      "/portal/notifications": t("notifications.title"),
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
      {session.impersonator ? (
        <ImpersonationBanner userName={session.user.displayName} />
      ) : null}
      {children}
    </DashboardShell>
  )
}
