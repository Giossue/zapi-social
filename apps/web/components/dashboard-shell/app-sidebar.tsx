"use client"

import Link from "next/link"

import { ZapiLogo } from "@/components/zapi-logo"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

import { DashboardNavMain } from "./nav-main"
import type {
  DashboardNavigationGroup,
  DashboardNavigationLink,
} from "./navigation-types"

type DashboardSidebarProps = React.ComponentProps<typeof Sidebar> & {
  homeHref: string
  isItemActive: (item: DashboardNavigationLink, pathname: string) => boolean
  items: readonly DashboardNavigationGroup[]
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
              <span className="font-semibold text-base">Zapi Social</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}

export function DashboardSidebar({
  homeHref,
  isItemActive,
  items,
  ...props
}: DashboardSidebarProps) {
  return (
    <Sidebar {...props}>
      <DashboardSidebarHeader homeHref={homeHref} />
      <SidebarContent>
        <DashboardNavMain isItemActive={isItemActive} items={items} />
      </SidebarContent>
    </Sidebar>
  )
}
