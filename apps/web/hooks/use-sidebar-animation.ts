"use client"

import { animate, createScope } from "animejs"
import { useLayoutEffect, useRef, useState } from "react"

const EXPANDED_WIDTH = 288
const COLLAPSED_WIDTH = 80
const EXPAND_MOTION = { duration: 260, ease: "out(4)" }
const COLLAPSE_MOTION = { delay: 140, duration: 420, ease: "inOutQuad" }

export function useSidebarAnimation(collapsed: boolean) {
  const rootRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const [isCollapsing, setIsCollapsing] = useState(false)

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current
    const content = contentRef.current
    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let isCurrent = true
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
        setIsCollapsing(false)
        return
      }

      setIsCollapsing(collapsed)
      const motion = collapsed ? COLLAPSE_MOTION : EXPAND_MOTION
      scope?.revert()
      scope = createScope({ root: rootRef }).add(() => {
        const sidebarAnimation = sidebar
          ? animate(sidebar, {
              width: targetWidth,
              ...motion,
            })
          : null

        if (content)
          animate(content, {
            paddingLeft: targetWidth,
            ...motion,
          })

        if (collapsed && sidebarAnimation) {
          sidebarAnimation.then(() => {
            if (isCurrent) setIsCollapsing(false)
          })
        }
      })
    }

    applyLayout()
    mediaQuery.addEventListener("change", applyLayout)
    reducedMotion.addEventListener("change", applyLayout)
    return () => {
      isCurrent = false
      scope?.revert()
      mediaQuery.removeEventListener("change", applyLayout)
      reducedMotion.removeEventListener("change", applyLayout)
    }
  }, [collapsed])

  return { contentRef, isCollapsing, rootRef, sidebarRef }
}
