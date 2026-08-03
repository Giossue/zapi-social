"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { ScrollArea } from "@workspace/ui/components/scroll-area"
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
} from "@workspace/ui/components/sidebar"

import { AccountMenu } from "@/components/account-menu"
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
  const { setOpenMobile } = useSidebar()

  return (
    <>
      <SidebarHeader className="relative h-11 p-0">
        <SidebarMenuButton asChild className="h-9" tooltip="Zapi Social">
          <Link href="/admin" onClick={() => setOpenMobile(false)}>
            <Image
              alt="Zapi Social"
              className="size-9 shrink-0 rounded-lg"
              height={36}
              src="/brand/logo-brand-dark.png"
              width={36}
            />
            <span className="flex min-w-0 flex-col items-start">
              <span className="truncate text-sm font-semibold">
                Zapi Social
              </span>
              <span className="text-xs text-muted-foreground">Plataforma</span>
            </span>
          </Link>
        </SidebarMenuButton>
        <SidebarTrigger
          aria-label="Cerrar navegación"
          className="absolute top-1/2 right-0 -translate-y-1/2 lg:hidden"
          size="icon"
          variant="brand-secondary"
        />
      </SidebarHeader>
      <SidebarContent className="mt-5 min-h-0">
        <ScrollArea className="-mr-2 min-h-0 flex-1 pr-2">
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
                            onClick={() => setOpenMobile(false)}
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
        </ScrollArea>
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
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
    >
      <Sidebar
        collapsible="offcanvas"
        aria-label="Navegación principal de la plataforma"
      >
        <AdminSidebarContent pathname={pathname} />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 sm:px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <SidebarTrigger
              aria-label="Alternar navegación"
              className="shrink-0"
              size="icon"
              variant="brand-secondary"
            />
            <div>
              <p className="text-xs text-muted-foreground">Plataforma</p>
              <h1 className="text-sm font-semibold">
                {currentItem?.label ?? "Administración"}
              </h1>
            </div>
          </div>
          <AccountMenu profile={profile} />
        </header>
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
