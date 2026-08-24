"use client"

import Link from "next/link"

import { ZapiLogo } from "@/components/zapi-logo"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

import { DashboardNavMain } from "./nav-main"
import { DashboardNavUser } from "./nav-user"
import type {
  DashboardNavigationGroup,
  DashboardNavigationLink,
} from "./navigation-types"
import type { AccountProfile } from "../account-menu"

type DashboardSidebarProps = React.ComponentProps<typeof Sidebar> & {
  activeIndicators: ReadonlySet<string>
  homeHref: string
  indicatorLabel: string
  lockedLabel: string
  isItemActive: (item: DashboardNavigationLink, pathname: string) => boolean
  items: readonly DashboardNavigationGroup[]
  profile: AccountProfile
}

function DashboardSidebarHeader({ homeHref }: { homeHref: string }) {
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href={homeHref} onClick={() => setOpenMobile(false)}>
              <ZapiLogo className="size-5 shrink-0" />
              <span className="text-base font-semibold">Zapi Social</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}

export function DashboardSidebar({
  activeIndicators,
  homeHref,
  indicatorLabel,
  lockedLabel,
  isItemActive,
  items,
  profile,
  ...props
}: DashboardSidebarProps) {
  return (
    <Sidebar {...props}>
      <DashboardSidebarHeader homeHref={homeHref} />
      <SidebarContent>
        <DashboardNavMain
          activeIndicators={activeIndicators}
          indicatorLabel={indicatorLabel}
          lockedLabel={lockedLabel}
          isItemActive={isItemActive}
          items={items}
        />
      </SidebarContent>
      <SidebarFooter>
        <DashboardNavUser profile={profile} />
      </SidebarFooter>
    </Sidebar>
  )
}
