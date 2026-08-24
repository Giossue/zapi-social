"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Measures the native scroll so a bar can mirror it. The element keeps doing
 * the scrolling, which is why this stays smooth: the bar is a readout, not the
 * control, so there is no drag maths that can disagree with the real position.
 */
function useScrollbar(ref: React.RefObject<HTMLElement | null>) {
  const [bar, setBar] = React.useState({ offset: 0, size: 0, visible: false })

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const { clientWidth, scrollLeft, scrollWidth } = element
      setBar({
        offset: scrollWidth ? (scrollLeft / scrollWidth) * 100 : 0,
        size: scrollWidth ? (clientWidth / scrollWidth) * 100 : 0,
        visible: scrollWidth > clientWidth,
      })
    }

    update()
    element.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    // The container is always full width, so watching it only catches window
    // and sidebar resizes. What decides whether there is anything to scroll to
    // is the table inside, which grows as rows and columns land.
    observer.observe(element)
    for (const child of element.children) observer.observe(child)

    return () => {
      element.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [ref])

  return bar
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const scroller = React.useRef<HTMLDivElement>(null)
  const bar = useScrollbar(scroller)

  /**
   * Lleva el scroll al punto del carril donde está el puntero, centrando el
   * pulgar bajo el cursor. La barra parece un scrollbar, así que tiene que
   * comportarse como uno: antes solo pintaba la posición y no había forma de
   * arrastrar, porque la nativa está oculta.
   */
  function scrollToPointer(clientX: number, track: HTMLElement) {
    const element = scroller.current
    if (!element) return
    const { left, width } = track.getBoundingClientRect()
    if (!width) return
    const ratio = (clientX - left) / width
    const maximum = element.scrollWidth - element.clientWidth
    const target = ratio * element.scrollWidth - element.clientWidth / 2
    element.scrollLeft = Math.min(Math.max(target, 0), maximum)
  }

  return (
    // The bar is a sibling of the scroller, not a child, so it stays pinned to
    // the visible edge instead of scrolling away with the columns.
    <div className="relative w-full">
      <div
        data-slot="table-container"
        // The platform bar is hidden because it fades out and would sit next
        // to ours; `pb-2` keeps the row it used to occupy.
        className="no-scrollbar w-full overflow-x-auto pb-2"
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
      {bar.visible ? (
        <div
          aria-hidden="true"
          // `py-1.5` agranda la zona de agarre sin engordar la barra: 1,5 px de
          // alto es imposible de coger con el ratón.
          className="absolute inset-x-4 bottom-0 cursor-grab py-1.5 active:cursor-grabbing"
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            scrollToPointer(event.clientX, event.currentTarget)
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            scrollToPointer(event.clientX, event.currentTarget)
          }}
          onPointerUp={(event) =>
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        >
          <div
            className="h-1.5 rounded-full bg-border"
            style={{ marginLeft: `${bar.offset}%`, width: `${bar.size}%` }}
          />
        </div>
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
