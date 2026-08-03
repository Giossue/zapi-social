"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, PanelLeftClose, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

import { AccountMenu } from "@/components/account-menu"
import { SidebarNavigationTooltip } from "@/components/sidebar-navigation-tooltip"
import { usePersistedSidebarState } from "@/hooks/use-persisted-sidebar-state"
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
  const currentItem = getAdminNavigationItem(pathname)

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
            href="/admin"
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
                Plataforma
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
          <Button
            aria-label="Cerrar navegación"
            className="absolute top-1/2 right-0 -translate-y-1/2 lg:hidden"
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
                <p
                  className={`overflow-hidden px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-[max-height,opacity,padding] duration-200 ease-out ${collapsed ? "max-h-0 pb-0 opacity-0" : "max-h-6 pb-1 opacity-100"}`}
                >
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const active = isAdminNavigationItemActive(item, pathname)
                  const Icon = item.icon
                  const iconPosition = collapsed
                    ? "left-1/2 -translate-x-1/2"
                    : "left-2.5 translate-x-0"
                  const labelVisibility = collapsed
                    ? "ml-0 max-w-0 opacity-0"
                    : "ml-6 max-w-xs opacity-100"

                  return (
                    <SidebarNavigationTooltip
                      enabled={collapsed}
                      key={item.href}
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
                          <Icon
                            className={`absolute shrink-0 transition-[left,transform] duration-200 ease-out ${iconPosition}`}
                          />
                          <span
                            className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-out ${labelVisibility}`}
                          >
                            {item.label}
                          </span>
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
      <div
        className={`min-h-dvh transition-[padding-left] duration-200 ease-out ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}
      >
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
