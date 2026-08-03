"use client"

import {
  createContext,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

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
  const { compact, mobileOpen, setMobileOpen } = useSidebar()
  const desktopWidth = compact ? "lg:w-20" : "lg:w-72"

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
        data-collapsible={compact ? "icon" : undefined}
        data-slot="sidebar"
        data-state={compact ? "collapsed" : "expanded"}
      >
        <div
          aria-hidden="true"
          className={cn(
            "hidden w-0 shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block",
            desktopWidth
          )}
          data-slot="sidebar-gap"
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar p-3 transition-[transform,width] duration-200 ease-out motion-reduce:transition-none lg:translate-x-0",
            desktopWidth,
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
          data-collapsible={compact ? "icon" : undefined}
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
      className={cn("relative flex min-w-0 flex-1 flex-col", className)}
      data-slot="sidebar-inset"
      {...props}
    />
  )
}

export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 p-2", className)}
      data-slot="sidebar-header"
      {...props}
    />
  )
}

export function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-2", className)}
      data-slot="sidebar-content"
      {...props}
    />
  )
}

export function SidebarGroup({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      data-slot="sidebar-group"
      {...props}
    />
  )
}

export function SidebarGroupLabel({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "flex h-7 shrink-0 items-center overflow-hidden px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-[margin,opacity] duration-200 ease-out group-data-[collapsible=icon]/sidebar:-mt-7 group-data-[collapsible=icon]/sidebar:opacity-0 motion-reduce:transition-none",
        className
      )}
      data-slot="sidebar-group-label"
      {...props}
    />
  )
}

export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      data-slot="sidebar-menu"
      {...props}
    />
  )
}

export function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn("group/menu-item relative", className)}
      data-slot="sidebar-menu-item"
      {...props}
    />
  )
}

type SidebarMenuButtonProps = ComponentProps<typeof Button> & {
  isActive?: boolean
  tooltip?: ReactNode
}

export function SidebarMenuButton({
  className,
  isActive = false,
  tooltip,
  variant,
  ...props
}: SidebarMenuButtonProps) {
  const { compact } = useSidebar()
  const button = (
    <Button
      className={cn(
        "h-8 w-full justify-start overflow-hidden px-2 group-data-[collapsible=icon]/sidebar:justify-center [&>span]:truncate group-data-[collapsible=icon]/sidebar:[&>span]:hidden [&>svg]:size-4",
        className
      )}
      data-active={isActive}
      data-slot="sidebar-menu-button"
      variant={isActive ? "sidebar-active" : (variant ?? "sidebar")}
      {...props}
    />
  )

  if (!tooltip) return button

  return (
    <Tooltip open={compact ? undefined : false}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        className={cn(!compact && "hidden")}
        side="right"
        sideOffset={10}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export function SidebarMenuSub({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]/sidebar:hidden",
        className
      )}
      data-slot="sidebar-menu-sub"
      {...props}
    />
  )
}

export function SidebarMenuSubItem({
  className,
  ...props
}: ComponentProps<"li">) {
  return <li className={cn("group/menu-sub-item", className)} {...props} />
}

type SidebarMenuSubButtonProps = ComponentProps<typeof Button> & {
  isActive?: boolean
}

export function SidebarMenuSubButton({
  className,
  isActive = false,
  variant,
  ...props
}: SidebarMenuSubButtonProps) {
  return (
    <Button
      className={cn("h-7 w-full justify-start px-2 text-xs", className)}
      data-active={isActive}
      data-slot="sidebar-menu-sub-button"
      size="sm"
      variant={isActive ? "sidebar-active" : (variant ?? "sidebar")}
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
