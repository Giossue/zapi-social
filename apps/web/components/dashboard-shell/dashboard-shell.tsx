"use client"

import { useBranding } from "@/components/branding-provider"
import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

import type { AccountProfile } from "@/components/account-menu"
import type { ActiveWorkspace } from "@workspace/contracts"
import { usePersistedSidebarState } from "@/hooks/use-persisted-sidebar-state"

import { DashboardSidebar } from "./app-sidebar"
import type {
  DashboardNavigationGroup,
  DashboardNavigationLink,
} from "./navigation-types"
import { NotificationBell } from "./notification-bell"
import { DashboardSearchDialog } from "./search-dialog"
import { ThemeSwitcher } from "./theme-switcher"
import { WorkspaceSwitcher } from "./workspace-switcher"
import { subscribeToNotificationUnread } from "@/features/notifications/notification-indicator"

type DashboardShellProps = {
  areaName: "Admin" | "Portal"
  children: React.ReactNode
  documentTitleOverrides?: Readonly<Record<string, string>>
  homeHref: string
  isItemActive: (item: DashboardNavigationLink, pathname: string) => boolean
  items: readonly DashboardNavigationGroup[]
  navigationLabel: string
  profile: AccountProfile
  secondaryNavigation?: React.ReactNode
  sidebarStorageKey: string
  workspaceContext?: {
    activeWorkspace: ActiveWorkspace
    workspaces: ActiveWorkspace[]
  }
}

function getRouteLabel(
  items: readonly DashboardNavigationGroup[],
  pathname: string
) {
  return items
    .flatMap((group) =>
      group.items.flatMap((item) =>
        "children" in item ? item.children : [item]
      )
    )
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((first, second) => second.href.length - first.href.length)[0]?.label
}

export function DashboardShell({
  areaName,
  children,
  documentTitleOverrides,
  homeHref,
  isItemActive,
  items,
  navigationLabel,
  profile,
  secondaryNavigation,
  sidebarStorageKey,
  workspaceContext,
}: DashboardShellProps) {
  const t = useTranslations("shell")
  const pathname = usePathname()
  const [collapsed, setCollapsed] = usePersistedSidebarState(sidebarStorageKey)
  const [notificationUnread, setNotificationUnread] = useState(0)
  const activeIndicators = useMemo(
    () => new Set(notificationUnread > 0 ? ["notifications"] : []),
    [notificationUnread]
  )

  const { siteName } = useBranding()

  useEffect(() => subscribeToNotificationUnread(setNotificationUnread), [])

  useEffect(() => {
    const routeLabel =
      documentTitleOverrides?.[pathname] ?? getRouteLabel(items, pathname)
    document.title = `${routeLabel || areaName} - ${siteName}`
  }, [areaName, documentTitleOverrides, items, pathname, siteName])

  return (
    <SidebarProvider
      open={!collapsed}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
      onOpenChange={(open) => setCollapsed(!open)}
    >
      <DashboardSidebar
        activeIndicators={activeIndicators}
        aria-label={navigationLabel}
        collapsible="icon"
        homeHref={homeHref}
        indicatorLabel={t("navigationIndicator")}
        lockedLabel={t("planLocked.navigationLabel")}
        isItemActive={isItemActive}
        items={items}
        plansHref={areaName === "Admin" ? undefined : "/portal/plans"}
        profile={profile}
        profileHref={
          areaName === "Admin" ? "/admin/profile" : "/portal/profile"
        }
        variant="inset"
      />
      <SidebarInset
        className={cn(
          "[&>*]:mx-auto",
          "[&>*]:w-full",
          "[&>*]:max-w-screen-2xl",
          "peer-data-[variant=inset]:border",
          "[--dashboard-header-height:--spacing(12)]",
          "min-w-0 overflow-x-clip"
        )}
      >
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
            "sticky top-0 z-50 overflow-hidden rounded-t-[inherit] bg-background/50 backdrop-blur-md"
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
                orientation="vertical"
              />
              <DashboardSearchDialog
                items={items}
                lockedLabel={t("planLocked.navigationLabel")}
              />
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              {workspaceContext ? (
                <>
                  <NotificationBell />
                  <WorkspaceSwitcher {...workspaceContext} />
                </>
              ) : null}
            </div>
          </div>
        </header>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-x-hidden",
            secondaryNavigation
              ? "flex flex-col md:flex-row"
              : "p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0"
          )}
        >
          {secondaryNavigation}
          {secondaryNavigation ? (
            <div className="min-w-0 flex-1 p-4 md:p-6">{children}</div>
          ) : (
            children
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
