"use client"

import Link from "next/link"

import { BrandMark, BrandName } from "@/components/brand-mark"

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
  loading?: boolean
  lockedLabel: string
  isItemActive: (item: DashboardNavigationLink, pathname: string) => boolean
  items: readonly DashboardNavigationGroup[]
  plansHref?: string
  profile?: AccountProfile
  profileHref: string
}

function DashboardSidebarHeader({ homeHref }: { homeHref: string }) {
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href={homeHref} onClick={() => setOpenMobile(false)}>
              <BrandMark className="size-5 shrink-0" />
              <span className="text-base font-semibold">
                <BrandName />
              </span>
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
  loading = false,
  lockedLabel,
  isItemActive,
  items,
  plansHref,
  profile,
  profileHref,
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
        <DashboardNavUser
          loading={loading}
          plansHref={plansHref}
          profile={profile}
          profileHref={profileHref}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
