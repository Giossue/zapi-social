"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import { LogOut, Moon, Sun, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { announceSessionLogout } from "@/features/identity/components/session-synchronizer"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

type AccountMenuProps = {
  profile: {
    displayName: string
    email: string
  }
}

function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function AccountMenu({ profile }: AccountMenuProps) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [themeMounted, setThemeMounted] = useState(false)

  useEffect(() => {
    setThemeMounted(true)
  }, [])

  async function logout() {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Abrir menú de cuenta"
          className="size-8 rounded-full p-0"
          variant="brand-secondary"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {initials(profile.displayName) || "Z"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" size="compact">
        <DropdownMenuLabel className="grid gap-0.5" size="compact">
          <span className="font-medium">{profile.displayName}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {profile.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <DropdownMenuItem asChild size="compact">
          <Link href="/portal/profile">
            <UserRound aria-hidden="true" /> Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <DropdownMenuItem
          className="justify-between"
          size="compact"
          onSelect={(event) => event.preventDefault()}
        >
          <span className="flex items-center gap-2">
            {themeMounted && resolvedTheme === "dark" ? (
              <Moon aria-hidden="true" />
            ) : (
              <Sun aria-hidden="true" />
            )}
            Tema oscuro
          </span>
          <Switch
            aria-label="Alternar modo oscuro"
            checked={themeMounted && resolvedTheme === "dark"}
            disabled={!themeMounted}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          size="compact"
          onSelect={() => void logout()}
        >
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
