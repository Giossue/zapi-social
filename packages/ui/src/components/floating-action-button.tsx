"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

/** Distance scrolled before the button is allowed to hide. */
const HIDE_AFTER = 96
/** Movement needed to flip the visibility, so tiny jitters don't toggle it. */
const SCROLL_THRESHOLD = 12
/** Slack from the end of the page where the button always stays visible. */
const BOTTOM_SLACK = 32

/**
 * Hides while the page scrolls down and brings the button back on the way up,
 * the way native mobile apps keep a floating action out of the reader's way.
 */
function useHideOnScrollDown() {
  const [hidden, setHidden] = React.useState(false)

  React.useEffect(() => {
    let lastY = window.scrollY
    let frame = 0

    const measure = () => {
      frame = 0
      const y = window.scrollY
      const delta = y - lastY
      if (Math.abs(delta) < SCROLL_THRESHOLD) return
      lastY = y

      const atEnd =
        y + window.innerHeight >=
        document.documentElement.scrollHeight - BOTTOM_SLACK
      setHidden(delta > 0 && y > HIDE_AFTER && !atEnd)
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return hidden
}

type FloatingActionButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "children" | "size"
> & {
  /** Accessible name for the action, e.g. "Nuevo caption". */
  label: string
  /** Defaults to a plus sign. */
  icon?: React.ReactNode
}

/**
 * Mobile counterpart of a page's primary action. Renders a circular button
 * pinned to the bottom-right corner, plus a spacer so the last row of content
 * stays reachable underneath it.
 */
function FloatingActionButton({
  className,
  icon,
  label,
  ...props
}: FloatingActionButtonProps) {
  const hidden = useHideOnScrollDown()

  return (
    <>
      <div aria-hidden="true" className="h-24 sm:hidden" />
      <Button
        aria-label={label}
        className={cn(
          "fixed right-4 bottom-[calc(1rem_+_env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none sm:hidden",
          hidden &&
            "pointer-events-none translate-y-[calc(100%_+_1.5rem)] opacity-0",
          className
        )}
        size="icon"
        type="button"
        {...props}
      >
        {icon ?? <Plus aria-hidden="true" className="size-6" />}
      </Button>
    </>
  )
}

export { FloatingActionButton }
export type { FloatingActionButtonProps }
