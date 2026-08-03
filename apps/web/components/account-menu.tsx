"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { toast } from "@workspace/ui/components/toast"
import { CircleUser, LogOut } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { announceSessionLogout } from "@/features/identity/components/session-synchronizer"

export type AccountProfile = {
  displayName: string
  email: string
}

type AccountMenuProps = {
  profile: AccountProfile
}

export function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function useSessionLogout() {
  const router = useRouter()

  return async function logout() {
    try {
      await authApi.logout()
      announceSessionLogout()
      router.replace("/login")
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Logout request failed", {
          code: error.code,
          requestId: error.requestId,
        })
      } else {
        console.error("Logout request failed", error)
      }
      toast.error("No pudimos cerrar tu sesión. Inténtalo de nuevo.")
    }
  }
}

export function AccountMenu({ profile }: AccountMenuProps) {
  const logout = useSessionLogout()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-8 rounded-lg">
          <AvatarFallback>{initials(profile.displayName) || "Z"}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56 space-y-1 rounded-lg"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-9 rounded-lg">
              <AvatarFallback>{initials(profile.displayName) || "Z"}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{profile.displayName}</span>
              <span className="truncate text-xs">{profile.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/portal/profile">
              <CircleUser aria-hidden="true" />
              Mi perfil
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
