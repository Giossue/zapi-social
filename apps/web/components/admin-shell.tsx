"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, PanelLeftClose, X } from "lucide-react"

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
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/shared/sidebar-layout"
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
      <SidebarHeader className="relative h-11 p-0">
        <SidebarMenuButton
          asChild
          className="h-9"
          tooltip="Zapi Social"
          variant="sidebar"
        >
          <Link href="/admin" onClick={() => setMobileOpen(false)}>
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
              <span className="text-xs text-muted-foreground">Plataforma</span>
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
          aria-label="Navegación administrativa"
          className="flex flex-col gap-3 pb-3"
        >
          {adminNavigationGroups.map((group) => (
            <SidebarGroup
              key={group.label}
              aria-label={group.label}
              className="p-0"
            >
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isAdminNavigationItemActive(item, pathname)
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.href}>
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
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
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
