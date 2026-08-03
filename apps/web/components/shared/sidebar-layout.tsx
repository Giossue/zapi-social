"use client"

import {
  createContext,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"

import { Button } from "@workspace/ui/components/button"

type SidebarStateSetter = (
  next: boolean | ((current: boolean) => boolean)
) => void

type SidebarContextValue = {
  collapsed: boolean
  compact: boolean
  mobileOpen: boolean
  setCollapsed: SidebarStateSetter
  setMobileOpen: (open: boolean) => void
}

type SidebarProviderProps = {
  children: ReactNode
  collapsed: boolean
  onCollapsedChange: SidebarStateSetter
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const context = useContext(SidebarContext)

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

export function SidebarProvider({
  children,
  collapsed,
  onCollapsedChange,
}: SidebarProviderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const contextValue = {
    collapsed,
    compact: collapsed && !mobileOpen,
    mobileOpen,
    setCollapsed: onCollapsedChange,
    setMobileOpen,
  }

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        className="group/sidebar-provider flex min-h-dvh w-full bg-background text-foreground"
        data-slot="sidebar-provider"
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

type SidebarProps = {
  "aria-label": string
  children: ReactNode
}

export function Sidebar({ children, ...props }: SidebarProps) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar()
  const desktopWidth = collapsed ? "lg:w-20" : "lg:w-72"

  return (
    <>
      {mobileOpen ? (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <div
        className="group/sidebar relative shrink-0"
        data-slot="sidebar"
        data-state={collapsed ? "collapsed" : "expanded"}
      >
        <div
          aria-hidden="true"
          className={`hidden w-0 shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block ${desktopWidth}`}
          data-slot="sidebar-gap"
        />
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar p-3 transition-[transform,width] duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 ${desktopWidth} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
          data-slot="sidebar-container"
          {...props}
        >
          {children}
        </aside>
      </div>
    </>
  )
}

export function SidebarInset({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`relative flex min-w-0 flex-1 flex-col ${className ?? ""}`}
      data-slot="sidebar-inset"
      {...props}
    />
  )
}

export function SidebarTrigger({
  children,
  onClick,
  ...props
}: ComponentProps<typeof Button>) {
  const { setMobileOpen } = useSidebar()

  return (
    <Button
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) setMobileOpen(true)
      }}
      {...props}
    >
      {children}
    </Button>
  )
}
