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
  return (
    <Tooltip open={enabled ? undefined : false}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {enabled ? (
        <TooltipContent side="right" sideOffset={10}>
          {label}
        </TooltipContent>
      ) : null}
    </Tooltip>
  )
}
