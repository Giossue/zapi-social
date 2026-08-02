"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

import { AccountMenu } from "@/components/account-menu"
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
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar p-3 transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-3 px-2 py-2">
          <Link
            className="flex min-w-0 items-center gap-3"
            href="/admin"
            onClick={() => setMobileOpen(false)}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              Z
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                Zapi Social
              </span>
              <span className="block text-xs text-muted-foreground">
                Plataforma
              </span>
            </span>
          </Link>
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
                <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const active = isAdminNavigationItemActive(item, pathname)
                  const Icon = item.icon
                  return (
                    <Button
                      asChild
                      className="w-full justify-start"
                      key={item.href}
                      variant={active ? "sidebar-active" : "sidebar"}
                    >
                      <Link
                        aria-current={active ? "page" : undefined}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon />
                        {item.label}
                      </Link>
                    </Button>
                  )
                })}
              </section>
            ))}
          </nav>
        </ScrollArea>
      </aside>
      <div className="min-h-dvh lg:pl-72">
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
