"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Menu, PanelLeftClose, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

import { AccountMenu } from "@/components/account-menu"
import { SidebarNavigationTooltip } from "@/components/sidebar-navigation-tooltip"
import { usePersistedSidebarState } from "@/hooks/use-persisted-sidebar-state"
import { useSidebarAnimation } from "@/hooks/use-sidebar-animation"
import {
  adminNavigationGroups,
  getAdminNavigationItem,
  isAdminNavigationItemActive,
} from "@/features/platform-admin/admin-navigation"

type AdminShellProps = {
  children: React.ReactNode
  profile: { displayName: string; email: string }
}

export function AdminShell({ children, profile }: AdminShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = usePersistedSidebarState(
    "zapi:admin-sidebar:v1"
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const { contentRef, isCollapsing, rootRef, sidebarRef } =
    useSidebarAnimation(collapsed)
  const currentItem = getAdminNavigationItem(pathname)
  const isCompact = collapsed && !isCollapsing

  return (
    <div className="min-h-dvh bg-background text-foreground" ref={rootRef}>
      {mobileOpen ? (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar p-3 transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`relative flex items-center gap-2 py-2 ${isCompact ? "justify-center px-0" : "justify-between px-2"}`}
        >
          <Link
            className="flex min-w-0 items-center gap-3"
            href="/admin"
            onClick={() => setMobileOpen(false)}
          >
            <Image
              alt="Zapi Social"
              className="size-9 shrink-0 rounded-lg"
              height={36}
              src="/brand/logo-brand-dark.png"
              width={36}
            />
            {isCompact ? null : (
              <span
                className={`min-w-0 transition-opacity duration-150 ${isCollapsing ? "opacity-0" : "opacity-100"}`}
              >
                <span className="block truncate text-sm font-semibold">
                  Zapi Social
                </span>
                <span className="block text-xs text-muted-foreground">
                  Plataforma
                </span>
              </span>
            )}
          </Link>
          <Button
            aria-label={
              isCompact ? "Expandir navegación" : "Contraer navegación"
            }
            className={`hidden lg:inline-flex ${isCompact ? "absolute top-2 -right-4" : ""}`}
            onClick={() => setCollapsed((value) => !value)}
            size="icon"
            variant="brand-secondary"
          >
            {isCompact ? <ChevronRight /> : <PanelLeftClose />}
          </Button>
          <Button
            aria-label="Cerrar navegación"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            size="icon"
            variant="brand-secondary"
          >
            <X />
          </Button>
        </div>
        <ScrollArea className="mt-5 -mr-2 min-h-0 flex-1">
          <nav
            aria-label="Navegación administrativa"
            className="flex flex-col gap-5 pr-3 pb-3"
          >
            {adminNavigationGroups.map((group) => (
              <section
                key={group.label}
                aria-label={group.label}
                className="space-y-1"
              >
                {isCompact ? null : (
                  <p
                    className={`px-3 pb-1 text-xs font-medium text-muted-foreground transition-opacity duration-150 ${isCollapsing ? "opacity-0" : "opacity-100"}`}
                  >
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const active = isAdminNavigationItemActive(item, pathname)
                  const Icon = item.icon
                  return (
                    <SidebarNavigationTooltip
                      enabled={isCompact}
                      key={item.href}
                      label={item.label}
                    >
                      <Button
                        asChild
                        aria-label={isCompact ? item.label : undefined}
                        className={
                          isCompact
                            ? "w-full justify-center"
                            : "w-full justify-start"
                        }
                        variant={active ? "sidebar-active" : "sidebar"}
                      >
                        <Link
                          aria-current={active ? "page" : undefined}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                        >
                          <Icon />
                          {isCompact ? null : (
                            <span
                              className={`transition-opacity duration-150 ${isCollapsing ? "opacity-0" : "opacity-100"}`}
                            >
                              {item.label}
                            </span>
                          )}
                        </Link>
                      </Button>
                    </SidebarNavigationTooltip>
                  )
                })}
              </section>
            ))}
          </nav>
        </ScrollArea>
      </aside>
      <div className="min-h-dvh lg:pl-72" ref={contentRef}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 sm:px-5 lg:px-8">
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
              <p className="text-xs text-muted-foreground">Plataforma</p>
              <h1 className="text-sm font-semibold">
                {currentItem?.label ?? "Administración"}
              </h1>
            </div>
          </div>
          <AccountMenu profile={profile} />
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
