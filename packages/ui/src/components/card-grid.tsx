import type { ComponentProps } from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Each entry pairs the breakpoint where the grid leaves the two-column phone
 * layout with the width it expands to. The `:last-child:nth-child(odd)`
 * selector matches a final card that would sit alone in a two-column row, so
 * the guard has to end exactly where the two-column layout does.
 *
 * Past that breakpoint, `:has(> *:nth-child(n):last-child)` matches on the
 * exact number of cards and drops the track count to match, so a short row
 * stretches across the full width instead of leaving a gap on the right. Those
 * rules outrank the plain `grid-cols-*` because `:has()` inherits the
 * specificity of its argument.
 *
 * Below the breakpoint there is nothing to fix: with two columns a lone card
 * is already caught by the odd-child rule above.
 */
const gridLayouts = {
  "2": "[&>*:last-child:nth-child(odd)]:col-span-2",
  "md-3":
    "md:grid-cols-3 max-md:[&>*:last-child:nth-child(odd)]:col-span-2 md:has-[>*:nth-child(1):last-child]:grid-cols-1 md:has-[>*:nth-child(2):last-child]:grid-cols-2",
  "xl-3":
    "xl:grid-cols-3 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2 xl:has-[>*:nth-child(1):last-child]:grid-cols-1 xl:has-[>*:nth-child(2):last-child]:grid-cols-2",
  "xl-4":
    "xl:grid-cols-4 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2 xl:has-[>*:nth-child(1):last-child]:grid-cols-1 xl:has-[>*:nth-child(2):last-child]:grid-cols-2 xl:has-[>*:nth-child(3):last-child]:grid-cols-3",
  "xl-5":
    "xl:grid-cols-5 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2 xl:has-[>*:nth-child(1):last-child]:grid-cols-1 xl:has-[>*:nth-child(2):last-child]:grid-cols-2 xl:has-[>*:nth-child(3):last-child]:grid-cols-3 xl:has-[>*:nth-child(4):last-child]:grid-cols-4",
} as const

type CardGridProps = ComponentProps<"div"> & {
  /** For grids that need to stay a landmark or a list. */
  as?: "div" | "section"
  layout?: keyof typeof gridLayouts
}

/**
 * Lays out card tiles two per row on phones instead of stacking them into one
 * long column. An odd last card spans the full row so it doesn't leave a hole
 * beside it.
 */
export function CardGrid({
  as: Component = "div",
  className,
  layout = "xl-4",
  ...props
}: CardGridProps) {
  return (
    <Component
      data-slot="card-grid"
      className={cn("grid grid-cols-2 gap-3", gridLayouts[layout], className)}
      {...props}
    />
  )
}

export type { CardGridProps }
