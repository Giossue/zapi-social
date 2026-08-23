"use client"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { useTranslations } from "next-intl"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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

type DashboardNavUserProps = {
  profile: AccountProfile
}

export function DashboardNavUser({ profile }: DashboardNavUserProps) {
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
              <Avatar className="size-8 rounded-lg grayscale">
                <AvatarFallback className="rounded-lg">
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
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
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
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link
                  href="/portal/profile"
                  onClick={() => setOpenMobile(false)}
                >
                  <CircleUser />
                  Mi perfil
                </Link>
              </DropdownMenuItem>
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
