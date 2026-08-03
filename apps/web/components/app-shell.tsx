"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Bell, ChevronDown, Menu, PanelLeftClose, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { AccountMenu } from "@/components/account-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/shared/sidebar-layout"
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

function PortalSidebarContent({ pathname }: { pathname: string }) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {}
  )
  const { compact, setCollapsed, setMobileOpen } = useSidebar()

  return (
    <>
      <SidebarHeader className="relative h-11 p-0">
        <SidebarMenuButton
          asChild
          className="h-9"
          tooltip="Zapi Social"
          variant="sidebar"
        >
          <Link href="/portal/dashboard" onClick={() => setMobileOpen(false)}>
            <Image
              alt="Zapi Social"
              className="size-9 shrink-0 rounded-lg"
              height={36}
              src="/brand/logo-brand-dark.png"
              width={36}
            />
            <span className="flex min-w-0 flex-col items-start group-data-[collapsible=icon]/sidebar:hidden">
              <span className="truncate text-sm font-semibold">
                Zapi Social
              </span>
              <span className="text-xs text-muted-foreground">Portal</span>
            </span>
          </Link>
        </SidebarMenuButton>
        <Button
          aria-label={compact ? "Expandir navegación" : "Contraer navegación"}
          className="absolute top-1/2 right-0 hidden -translate-y-1/2 group-data-[collapsible=icon]/sidebar:-right-4 lg:inline-flex"
          onClick={() => setCollapsed((value) => !value)}
          size="icon"
          variant="brand-secondary"
        >
          <PanelLeftClose className="transition-transform duration-200 ease-out group-data-[collapsible=icon]/sidebar:rotate-180 motion-reduce:transition-none" />
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
      </SidebarHeader>

      <SidebarContent className="mt-5 -mr-2 pr-2">
        <nav
          aria-label="Navegación del portal"
          className="flex flex-col gap-3 pb-3"
        >
          {portalNavigationGroups.map((group) => (
            <SidebarGroup
              key={group.label}
              aria-label={group.label}
              className="p-0"
            >
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
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

                  return (
                    <SidebarMenuItem key={item.label}>
                      {"href" in item ? (
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                        >
                          <Link
                            aria-current={active ? "page" : undefined}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                          >
                            {Icon ? <Icon /> : null}
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          aria-expanded={expanded}
                          aria-label={
                            compact ? `Expandir ${item.label}` : undefined
                          }
                          isActive={active}
                          onClick={() => {
                            if (compact) setCollapsed(false)
                            setExpandedItems((current) => ({
                              ...current,
                              [item.label]: !expanded,
                            }))
                          }}
                          tooltip={item.label}
                        >
                          {Icon ? <Icon /> : null}
                          <span>{item.label}</span>
                          <ChevronDown className="ml-auto transition-transform duration-200 ease-out group-aria-expanded/button:rotate-180 group-data-[collapsible=icon]/sidebar:hidden motion-reduce:transition-none" />
                        </SidebarMenuButton>
                      )}

                      {children && expanded ? (
                        <SidebarMenuSub>
                          {children.map((child) => {
                            const childActive = isPortalNavigationItemActive(
                              child,
                              pathname
                            )

                            return (
                              <SidebarMenuSubItem key={child.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={childActive}
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
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
    </>
  )
}

export function AppShell({ children, profile }: AppShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = usePersistedSidebarState(
    "zapi:portal-sidebar:v1"
  )
  const currentItem = getPortalNavigationItem(pathname)
  const pageLabel =
    pathname === "/portal/profile"
      ? "Mi perfil"
      : (currentItem?.label ?? "Portal")

  return (
    <SidebarProvider collapsed={collapsed} onCollapsedChange={setCollapsed}>
      <Sidebar aria-label="Navegación principal del portal">
        <PortalSidebarContent pathname={pathname} />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:px-8">
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
      </SidebarInset>
    </SidebarProvider>
  )
}
