import type { ComponentProps } from "react"

import { cn } from "@workspace/ui/lib/utils"

const gridLayouts = {
  "2": "[&>*:last-child:nth-child(odd)]:col-span-2",
  "md-3":
    "md:grid-cols-3 max-md:[&>*:last-child:nth-child(odd)]:col-span-2 md:has-[>*:nth-child(1):last-child]:grid-cols-1 md:has-[>*:nth-child(2):last-child]:grid-cols-2",
  "xl-3":
    "xl:grid-cols-3 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2 xl:has-[>*:nth-child(1):last-child]:grid-cols-1 xl:has-[>*:nth-child(2):last-child]:grid-cols-2",
  "xl-4":
    "xl:grid-cols-4 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2 xl:has-[>*:nth-child(1):last-child]:grid-cols-1 xl:has-[>*:nth-child(2):last-child]:grid-cols-2 xl:has-[>*:nth-child(3):last-child]:grid-cols-3",
  "xl-4-fixed": "xl:grid-cols-4",
  "xl-5":
    "xl:grid-cols-5 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2 xl:has-[>*:nth-child(1):last-child]:grid-cols-1 xl:has-[>*:nth-child(2):last-child]:grid-cols-2 xl:has-[>*:nth-child(3):last-child]:grid-cols-3 xl:has-[>*:nth-child(4):last-child]:grid-cols-4",
} as const

type CardGridProps = ComponentProps<"div"> & {
  as?: "div" | "section"
  layout?: keyof typeof gridLayouts
}

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
