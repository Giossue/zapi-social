"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, PanelLeftClose, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

import { AccountMenu } from "@/components/account-menu"
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/shared/sidebar-layout"
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

function AdminSidebarContent({ pathname }: { pathname: string }) {
  const { compact, setCollapsed, setMobileOpen } = useSidebar()

  return (
    <>
      <div className="relative h-11">
        <Link
          className="relative flex h-9 w-full items-center"
          href="/admin"
          onClick={() => setMobileOpen(false)}
        >
          <Image
            alt="Zapi Social"
            className={`absolute size-9 shrink-0 rounded-lg transition-[left,transform] duration-200 ease-out motion-reduce:transition-none ${compact ? "left-1/2 -translate-x-1/2" : "left-0 translate-x-0"}`}
            height={36}
            src="/brand/logo-brand-dark.png"
            width={36}
          />
          <span
            className={`ml-12 min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-out motion-reduce:transition-none ${compact ? "ml-0 max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}
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
          aria-label={compact ? "Expandir navegación" : "Contraer navegación"}
          className={`absolute top-1/2 hidden -translate-y-1/2 transition-[right] duration-200 ease-out motion-reduce:transition-none lg:inline-flex ${compact ? "-right-4" : "right-0"}`}
          onClick={() => setCollapsed((value) => !value)}
          size="icon"
          variant="brand-secondary"
        >
          <PanelLeftClose
            className={`transition-transform duration-200 ease-out motion-reduce:transition-none ${compact ? "rotate-180" : "rotate-0"}`}
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
                className={`overflow-hidden px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-[max-height,opacity,padding] duration-200 ease-out motion-reduce:transition-none ${compact ? "max-h-0 pb-0 opacity-0" : "max-h-6 pb-1 opacity-100"}`}
              >
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = isAdminNavigationItemActive(item, pathname)
                const Icon = item.icon
                const iconPosition = compact
                  ? "left-1/2 -translate-x-1/2"
                  : "left-2.5 translate-x-0"
                const labelVisibility = compact
                  ? "ml-0 max-w-0 opacity-0"
                  : "ml-6 max-w-xs opacity-100"

                return (
                  <SidebarNavigationTooltip
                    enabled={compact}
                    key={item.href}
                    label={item.label}
                  >
                    <Button
                      asChild
                      aria-label={compact ? item.label : undefined}
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
                          className={`absolute shrink-0 transition-[left,transform] duration-200 ease-out motion-reduce:transition-none ${iconPosition}`}
                        />
                        <span
                          className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-out motion-reduce:transition-none ${labelVisibility}`}
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
    </>
  )
}

export function AdminShell({ children, profile }: AdminShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = usePersistedSidebarState(
    "zapi:admin-sidebar:v1"
  )
  const currentItem = getAdminNavigationItem(pathname)

  return (
    <SidebarProvider collapsed={collapsed} onCollapsedChange={setCollapsed}>
      <Sidebar aria-label="Navegación principal de la plataforma">
        <AdminSidebarContent pathname={pathname} />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 sm:px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <SidebarTrigger
              aria-label="Abrir navegación"
              className="lg:hidden"
              size="icon"
              variant="brand-secondary"
            >
              <Menu />
            </SidebarTrigger>
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
      </SidebarInset>
    </SidebarProvider>
  )
}
