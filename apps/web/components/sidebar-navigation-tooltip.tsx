"use client"

import type { ReactElement } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

type SidebarNavigationTooltipProps = {
  children: ReactElement
  enabled: boolean
  label: string
}

export function SidebarNavigationTooltip({
  children,
  enabled,
  label,
}: SidebarNavigationTooltipProps) {
  if (!enabled) return children

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
