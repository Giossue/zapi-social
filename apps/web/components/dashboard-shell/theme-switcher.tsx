"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@workspace/ui/components/dropdown-menu"

const THEMES = [
  { icon: Sun, value: "light" },
  { icon: Moon, value: "dark" },
  { icon: Monitor, value: "system" },
] as const

type ThemeMode = (typeof THEMES)[number]["value"]

const subscribeNoop = () => () => {}

export function ThemeSwitcher() {
  const t = useTranslations("shell.theme")
  const { setTheme, theme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )

  const active = THEMES.find((item) => item.value === theme) ?? THEMES[2]
  const next = THEMES[(THEMES.indexOf(active) + 1) % THEMES.length] ?? THEMES[0]
  const CurrentIcon = mounted ? active.icon : Monitor

  return (
    <Button
      aria-label={`${t("label")}: ${t(active.value)}`}
      size="icon-sm"
      variant="ghost"
      onClick={() => setTheme(next.value)}
    >
      <CurrentIcon />
    </Button>
  )
}

export function ThemeMenuItem() {
  const t = useTranslations("shell.theme")
  const { setTheme, theme } = useTheme()
  const current = (THEMES.find((item) => item.value === theme)?.value ??
    "system") satisfies ThemeMode
  const CurrentIcon =
    THEMES.find((item) => item.value === current)?.icon ?? Monitor

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <CurrentIcon aria-hidden="true" />
        {t("label")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup onValueChange={setTheme} value={current}>
          {THEMES.map(({ icon: Icon, value }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden="true" />
              {t(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
