"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"

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
