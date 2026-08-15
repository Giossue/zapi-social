"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Tells whether the element still has content to scroll to on each side. Only
 * two booleans, so unlike a rendered scrollbar there is no position to keep in
 * sync with the real one.
 */
function useScrollEdges(ref: React.RefObject<HTMLElement | null>) {
  const [edges, setEdges] = React.useState({ end: false, start: false })

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () =>
      setEdges({
        end:
          Math.ceil(element.scrollLeft + element.clientWidth) <
          element.scrollWidth,
        start: element.scrollLeft > 0,
      })

    update()
    element.addEventListener("scroll", update, { passive: true })
    // Catches columns appearing, the sidebar collapsing and window resizes.
    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => {
      element.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [ref])

  return edges
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const scroller = React.useRef<HTMLDivElement>(null)
  const edges = useScrollEdges(scroller)

  return (
    // The overlays are siblings of the scroller, not children, so they stay
    // pinned to the visible edges instead of scrolling away with the columns.
    <div className="relative w-full">
      <div
        data-slot="table-container"
        className="w-full overflow-x-auto"
        ref={scroller}
      >
        <table
          data-slot="table"
          className={cn(
            "w-full caption-bottom text-sm **:data-[slot=table-cell]:px-4 **:data-[slot=table-cell]:py-4 **:data-[slot=table-head]:h-auto **:data-[slot=table-head]:px-4 **:data-[slot=table-head]:py-4 **:data-[slot=table-head]:font-normal",
            className
          )}
          {...props}
        />
      </div>
      {edges.start ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card to-transparent"
        />
      ) : null}
      {edges.end ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent"
        />
      ) : null}
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted/50 [&_tr]:border-y", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/60 transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-auto px-4 py-4 text-left align-middle font-normal whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-4 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
