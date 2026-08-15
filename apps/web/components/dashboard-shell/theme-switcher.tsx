"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@workspace/ui/components/dropdown-menu"

const THEMES = [
  { icon: Sun, label: "Claro", value: "light" },
  { icon: Moon, label: "Oscuro", value: "dark" },
  { icon: Monitor, label: "Sistema", value: "system" },
] as const

type ThemeMode = (typeof THEMES)[number]["value"]

/**
 * Lives inside the account menu rather than the header. The menu content only
 * mounts once opened, which is always after hydration, so `useTheme` has a
 * real value by the time this renders and needs no mounted guard.
 */
export function ThemeMenuItem() {
  const { setTheme, theme } = useTheme()
  const current = (THEMES.find((item) => item.value === theme)?.value ??
    "system") satisfies ThemeMode
  const CurrentIcon =
    THEMES.find((item) => item.value === current)?.icon ?? Monitor

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <CurrentIcon aria-hidden="true" />
        Tema
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup onValueChange={setTheme} value={current}>
          {THEMES.map(({ icon: Icon, label, value }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
