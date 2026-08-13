"use client"

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

import { AccountMenu } from "../account-menu"
import { DashboardSidebar } from "./app-sidebar"
import type {
  DashboardNavigationGroup,
  DashboardNavigationLink,
} from "./navigation-types"
import { DashboardSearchDialog } from "./search-dialog"
import { ThemeSwitcher } from "./theme-switcher"
import { WorkspaceSwitcher } from "./workspace-switcher"

type DashboardShellProps = {
  children: React.ReactNode
  homeHref: string
  isItemActive: (item: DashboardNavigationLink, pathname: string) => boolean
  items: readonly DashboardNavigationGroup[]
  navigationLabel: string
  profile: AccountProfile
  sidebarStorageKey: string
  workspaceContext?: {
    activeWorkspace: ActiveWorkspace
    workspaces: ActiveWorkspace[]
  }
}

export function DashboardShell({
  children,
  homeHref,
  isItemActive,
  items,
  navigationLabel,
  profile,
  sidebarStorageKey,
  workspaceContext,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = usePersistedSidebarState(sidebarStorageKey)

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
        aria-label={navigationLabel}
        collapsible="icon"
        homeHref={homeHref}
        isItemActive={isItemActive}
        items={items}
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
              <DashboardSearchDialog items={items} />
            </div>
            <div className="flex items-center gap-2">
              {workspaceContext ? (
                <WorkspaceSwitcher {...workspaceContext} />
              ) : null}
              <ThemeSwitcher />
              <AccountMenu profile={profile} />
            </div>
          </div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
