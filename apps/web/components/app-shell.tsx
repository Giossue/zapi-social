"use client"

import {
  portalModuleForHref,
  workspacePermissionForPortalHref,
  workspacePermissionMatches,
} from "@workspace/contracts"
import type { PortalAuthSession } from "@workspace/contracts"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { DashboardShell } from "@/components/dashboard-shell/dashboard-shell"
import type {
  DashboardNavigationGroup,
  DashboardNavigationItem,
} from "@/components/dashboard-shell/navigation-types"
import { ImpersonationBanner } from "@/features/identity/components/impersonation-banner"
import { PlanLockedModule } from "@/features/portal-shell/components/plan-locked-module"
import { useTranslatedNavigation } from "@/components/dashboard-shell/translate-navigation"
import {
  getPortalNavigationItem,
  isPortalNavigationItemActive,
  portalNavigationGroups,
} from "@/features/portal-shell/portal-navigation"

type AppShellProps = {
  children: React.ReactNode
  session: PortalAuthSession
}

export function AppShell({ children, session }: AppShellProps) {
  const t = useTranslations("shell")
  const navigationT = useTranslations("navigation.portal")
  const pathname = usePathname()
  const translated = useTranslatedNavigation(
    portalNavigationGroups,
    "navigation.portal"
  )
  const enabledModules = session.enabledModules
  const planModules = session.planModules
  const permissions = session.workspace.permissions
  const unrestricted = session.workspace.role !== "member"
  const items = useMemo(() => {
    return translated
      .map((group): DashboardNavigationGroup => {
        const items = group.items.flatMap((item): DashboardNavigationItem[] => {
          if ("children" in item) {
            const children = item.children.flatMap((child) => {
              const moduleKey = portalModuleForHref(child.href)
              const permission = workspacePermissionForPortalHref(child.href)
              const permissionGranted =
                !permission ||
                unrestricted ||
                workspacePermissionMatches(permissions, permission)
              if (!permissionGranted) return []
              return [
                {
                  ...child,
                  planLocked: Boolean(
                    moduleKey &&
                    enabledModules &&
                    !enabledModules.includes(moduleKey)
                  ),
                },
              ]
            })
            return children.length
              ? [
                  {
                    ...item,
                    children,
                    planLocked: children.every((child) => child.planLocked),
                  },
                ]
              : []
          }
          const moduleKey = portalModuleForHref(item.href)
          const permission = workspacePermissionForPortalHref(item.href)
          const permissionGranted =
            !permission ||
            unrestricted ||
            workspacePermissionMatches(permissions, permission)
          return permissionGranted
            ? [
                {
                  ...item,
                  planLocked: Boolean(
                    moduleKey &&
                    enabledModules &&
                    !enabledModules.includes(moduleKey)
                  ),
                },
              ]
            : []
        })
        return { ...group, items }
      })
      .filter((group) => group.items.length)
  }, [enabledModules, permissions, translated, unrestricted])
  const workspaces = session.workspaces?.length
    ? session.workspaces
    : [session.workspace]
  const activeModule = portalModuleForHref(pathname)
  const planLocked = Boolean(
    activeModule && enabledModules && !enabledModules.includes(activeModule)
  )
  const lockReason =
    activeModule && planModules && planModules.includes(activeModule)
      ? "workspace"
      : "plan"
  const activeNavigationItem = getPortalNavigationItem(pathname)
  const moduleLabel = activeNavigationItem
    ? navigationT(activeNavigationItem.labelKey)
    : t("planLocked.moduleFallback")

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
      {planLocked ? (
        <PlanLockedModule
          canManagePlan={session.workspace.role === "owner"}
          moduleLabel={moduleLabel}
          reason={lockReason}
          translations={{
            description: t("planLocked.description", { module: moduleLabel }),
            memberDescription: t("planLocked.memberDescription", {
              module: moduleLabel,
            }),
            planAction: t("planLocked.planAction"),
            previewDescription: t("planLocked.previewDescription"),
            title: t("planLocked.title"),
            workspaceAction: t("planLocked.workspaceAction"),
            workspaceDescription: t("planLocked.workspaceDescription", {
              module: moduleLabel,
            }),
          }}
        />
      ) : (
        children
      )}
    </DashboardShell>
  )
}
