"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

const HIDE_AFTER = 96
const SCROLL_THRESHOLD = 12
const BOTTOM_SLACK = 32

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
  label: string
  icon?: React.ReactNode
  withSpacer?: boolean
  menu?: React.ReactNode
}

function FloatingActionButton({
  className,
  icon,
  label,
  menu,
  withSpacer = true,
  ...props
}: FloatingActionButtonProps) {
  const hidden = useHideOnScrollDown()

  const button = (
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
  )

  return (
    <>
      {withSpacer ? (
        <div aria-hidden="true" className="h-24 sm:hidden" />
      ) : null}
      {menu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
          {menu}
        </DropdownMenu>
      ) : (
        button
      )}
    </>
  )
}

export { FloatingActionButton }
export type { FloatingActionButtonProps }
