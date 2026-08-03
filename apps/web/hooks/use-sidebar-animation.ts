"use client"

import { animate, createScope } from "animejs"
import { useLayoutEffect, useRef } from "react"

const EXPANDED_WIDTH = 288
const COLLAPSED_WIDTH = 80

export function useSidebarAnimation(collapsed: boolean) {
  const rootRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current
    const content = contentRef.current
    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let scope: ReturnType<typeof createScope> | null = null

    function applyLayout() {
      if (!mediaQuery.matches) {
        sidebar?.style.removeProperty("width")
        content?.style.removeProperty("padding-left")
        return
      }

      const targetWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH
      if (!initializedRef.current || reducedMotion.matches) {
        sidebar?.style.setProperty("width", `${targetWidth}px`)
        content?.style.setProperty("padding-left", `${targetWidth}px`)
        initializedRef.current = true
        return
      }

      scope?.revert()
      scope = createScope({ root: rootRef }).add(() => {
        if (sidebar)
          animate(sidebar, {
            width: targetWidth,
            duration: 260,
            ease: "out(4)",
          })
        if (content)
          animate(content, {
            paddingLeft: targetWidth,
            duration: 260,
            ease: "out(4)",
          })
      })
    }

    applyLayout()
    mediaQuery.addEventListener("change", applyLayout)
    reducedMotion.addEventListener("change", applyLayout)
    return () => {
      scope?.revert()
      mediaQuery.removeEventListener("change", applyLayout)
      reducedMotion.removeEventListener("change", applyLayout)
    }
  }, [collapsed])

  return { contentRef, rootRef, sidebarRef }
}
