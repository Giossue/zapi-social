"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@workspace/ui/components/button"

const THEME_CYCLE = ["light", "dark", "system"] as const

type ThemeMode = (typeof THEME_CYCLE)[number]

const themeIcons = {
  dark: Sun,
  light: Moon,
  system: Monitor,
} satisfies Record<ThemeMode, typeof Monitor>

export function ThemeSwitcher() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const currentTheme: ThemeMode = mounted && THEME_CYCLE.includes(theme as ThemeMode) ? (theme as ThemeMode) : "system"
  const Icon = themeIcons[currentTheme]

  function cycleTheme() {
    const currentIndex = THEME_CYCLE.indexOf(currentTheme)
    const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length] ?? "light"

    setTheme(nextTheme)
  }

  return (
    <Button size="icon" onClick={cycleTheme} aria-label={`Tema actual: ${currentTheme}. Haz clic para cambiarlo`}>
      <Icon />
    </Button>
  )
}
