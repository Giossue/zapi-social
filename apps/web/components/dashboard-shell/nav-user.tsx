"use client"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { useTranslations } from "next-intl"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { CircleUser, EllipsisVertical, LogOut } from "lucide-react"
import Link from "next/link"

import {
  initials,
  type AccountProfile,
  useSessionLogout,
} from "@/components/account-menu"
import { ThemeMenuItem } from "@/components/dashboard-shell/theme-switcher"

type DashboardNavUserProps = {
  profile: AccountProfile
  profileHref: string
}

export function DashboardNavUser({
  profile,
  profileHref,
}: DashboardNavUserProps) {
  const t = useTranslations("navigation.user")
  const { isMobile, setOpenMobile } = useSidebar()
  const logout = useSessionLogout()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 grayscale">
                <AvatarFallback>
                  {initials(profile.displayName) || "Z"}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {profile.displayName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {profile.email}
                </span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={profileHref} onClick={() => setOpenMobile(false)}>
                  <CircleUser />
                  {t("myProfile")}
                </Link>
              </DropdownMenuItem>
              <ThemeMenuItem />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void logout()}
            >
              <LogOut />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
