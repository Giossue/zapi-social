import type { ComponentProps } from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Each entry pairs the breakpoint where the grid leaves the two-column phone
 * layout with the width it expands to. The `:last-child:nth-child(odd)`
 * selector matches a final card that would sit alone in a two-column row, so
 * the guard has to end exactly where the two-column layout does.
 */
const gridLayouts = {
  "md-3": "md:grid-cols-3 max-md:[&>*:last-child:nth-child(odd)]:col-span-2",
  "xl-3": "xl:grid-cols-3 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2",
  "xl-4": "xl:grid-cols-4 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2",
} as const

type CardGridProps = ComponentProps<"div"> & {
  layout?: keyof typeof gridLayouts
}

/**
 * Lays out card tiles two per row on phones instead of stacking them into one
 * long column. An odd last card spans the full row so it doesn't leave a hole
 * beside it.
 */
export function CardGrid({
  className,
  layout = "xl-4",
  ...props
}: CardGridProps) {
  return (
    <div
      data-slot="card-grid"
      className={cn("grid grid-cols-2 gap-3", gridLayouts[layout], className)}
      {...props}
    />
  )
}

export type { CardGridProps }
