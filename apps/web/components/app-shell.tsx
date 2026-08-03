"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Bell, ChevronDown, Menu, PanelLeftClose } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

import { AccountMenu } from "@/components/account-menu"
import { SidebarNavigationTooltip } from "@/components/sidebar-navigation-tooltip"
import { usePersistedSidebarState } from "@/hooks/use-persisted-sidebar-state"
import {
  getPortalNavigationItem,
  isPortalNavigationItemActive,
  portalNavigationGroups,
} from "@/features/portal-shell/portal-navigation"

type AppShellProps = {
  children: React.ReactNode
  profile: {
    displayName: string
    email: string
  }
}

export function AppShell({ children, profile }: AppShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = usePersistedSidebarState(
    "zapi:portal-sidebar:v1"
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {}
  )
  const currentItem = getPortalNavigationItem(pathname)
  const pageLabel =
    pathname === "/portal/profile"
      ? "Mi perfil"
      : (currentItem?.label ?? "Portal")

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {mobileOpen ? (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar p-3 transition-[width,transform] duration-200 ease-out lg:translate-x-0 ${collapsed ? "w-20" : "w-72"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="relative h-11">
          <Link
            className="relative flex h-9 w-full items-center"
            href="/portal/dashboard"
            onClick={() => setMobileOpen(false)}
          >
            <Image
              alt="Zapi Social"
              className={`absolute size-9 shrink-0 rounded-lg transition-[left,transform] duration-200 ease-out ${collapsed ? "left-1/2 -translate-x-1/2" : "left-0 translate-x-0"}`}
              height={36}
              src="/brand/logo-brand-dark.png"
              width={36}
            />
            <span
              className={`ml-12 min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-out ${collapsed ? "ml-0 max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}
            >
              <span className="block truncate text-sm font-semibold">
                Zapi Social
              </span>
              <span className="block text-xs text-muted-foreground">
                Portal
              </span>
            </span>
          </Link>
          <Button
            aria-label={
              collapsed ? "Expandir navegación" : "Contraer navegación"
            }
            className={`absolute top-1/2 hidden -translate-y-1/2 transition-[right] duration-200 ease-out lg:inline-flex ${collapsed ? "-right-4" : "right-0"}`}
            onClick={() => setCollapsed((value) => !value)}
            size="icon"
            variant="brand-secondary"
          >
            <PanelLeftClose
              className={`transition-transform duration-200 ease-out ${collapsed ? "rotate-180" : "rotate-0"}`}
            />
          </Button>
        </div>

        <ScrollArea className="mt-5 -mr-2 min-h-0 flex-1">
          <nav
            aria-label="Navegación del portal"
            className="flex flex-col gap-5 pr-3 pb-3"
          >
            {portalNavigationGroups.map((group) => (
              <section
                key={group.label}
                aria-label={group.label}
                className="space-y-1"
              >
                <p
                  className={`overflow-hidden px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-[max-height,opacity,padding] duration-200 ease-out ${collapsed ? "max-h-0 pb-0 opacity-0" : "max-h-6 pb-1 opacity-100"}`}
                >
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const children =
                    "children" in item ? item.children : undefined
                  const hasActiveChild = children?.some((child) =>
                    isPortalNavigationItemActive(child, pathname)
                  )
                  const active =
                    isPortalNavigationItemActive(item, pathname) ||
                    hasActiveChild
                  const expanded =
                    expandedItems[item.label] ?? hasActiveChild ?? false
                  const Icon = item.icon
                  const iconPosition = collapsed
                    ? "left-1/2 -translate-x-1/2"
                    : "left-2.5 translate-x-0"
                  const labelVisibility = collapsed
                    ? "ml-0 max-w-0 opacity-0"
                    : "ml-6 max-w-xs opacity-100"

                  return (
                    <div key={item.label} className="space-y-1">
                      {"href" in item ? (
                        <SidebarNavigationTooltip
                          enabled={collapsed}
                          label={item.label}
                        >
                          <Button
                            asChild
                            aria-label={collapsed ? item.label : undefined}
                            className="relative w-full justify-start gap-0"
                            variant={active ? "sidebar-active" : "sidebar"}
                          >
                            <Link
                              aria-current={active ? "page" : undefined}
                              className="relative flex h-full w-full items-center"
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                            >
                              {Icon ? (
                                <Icon
                                  className={`absolute shrink-0 transition-[left,transform] duration-200 ease-out ${iconPosition}`}
                                />
                              ) : null}
                              <span
                                className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-out ${labelVisibility}`}
                              >
                                {item.label}
                              </span>
                            </Link>
                          </Button>
                        </SidebarNavigationTooltip>
                      ) : (
                        <SidebarNavigationTooltip
                          enabled={collapsed}
                          label={item.label}
                        >
                          <Button
                            aria-expanded={expanded}
                            aria-label={
                              collapsed ? `Expandir ${item.label}` : undefined
                            }
                            className="relative w-full justify-start gap-0"
                            onClick={() => {
                              if (collapsed) setCollapsed(false)
                              setExpandedItems((current) => ({
                                ...current,
                                [item.label]: !expanded,
                              }))
                            }}
                            variant={active ? "sidebar-active" : "sidebar"}
                          >
                            {Icon ? (
                              <Icon
                                className={`absolute shrink-0 transition-[left,transform] duration-200 ease-out ${iconPosition}`}
                              />
                            ) : null}
                            <span
                              className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-out ${labelVisibility}`}
                            >
                              {item.label}
                            </span>
                            <ChevronDown
                              className={`absolute right-2.5 transition-[opacity,transform] duration-200 ease-out ${expanded ? "rotate-180" : "rotate-0"} ${collapsed ? "opacity-0" : "opacity-100"}`}
                            />
                          </Button>
                        </SidebarNavigationTooltip>
                      )}

                      {!children || !expanded ? null : (
                        <div
                          className={`ml-7 overflow-hidden border-l border-border pl-2 transition-[max-height,opacity,margin] duration-200 ease-out ${collapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}
                        >
                          <div className="space-y-0.5">
                            {children.map((child) => {
                              const childActive = isPortalNavigationItemActive(
                                child,
                                pathname
                              )
                              return (
                                <Button
                                  asChild
                                  className="w-full justify-start"
                                  key={child.href}
                                  size="sm"
                                  variant={
                                    childActive ? "sidebar-active" : "sidebar"
                                  }
                                >
                                  <Link
                                    aria-current={
                                      childActive ? "page" : undefined
                                    }
                                    href={child.href}
                                    onClick={() => setMobileOpen(false)}
                                  >
                                    {child.label}
                                  </Link>
                                </Button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      <div
        className={`min-h-dvh transition-[padding-left] duration-200 ease-out ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              aria-label="Abrir navegación"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              size="icon"
              variant="brand-secondary"
            >
              <Menu />
            </Button>
            <div>
              <p className="text-xs text-muted-foreground">Portal</p>
              <h1 className="text-sm font-semibold">{pageLabel}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              aria-label="Notificaciones"
              size="icon"
              variant="brand-secondary"
            >
              <Bell />
            </Button>
            <AccountMenu profile={profile} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
