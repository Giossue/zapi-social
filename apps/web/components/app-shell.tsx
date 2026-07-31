"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Menu,
  LogOut,
  Moon,
  PanelLeftClose,
  Sun,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import { ApiError, authApi } from "@workspace/api-client"
import { toast } from "@workspace/ui/components/toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { useTheme } from "next-themes"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  getPortalNavigationItem,
  isPortalNavigationItemActive,
  portalNavigationGroups,
} from "@/features/portal-shell/portal-navigation"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const currentItem = getPortalNavigationItem(pathname)
  const { resolvedTheme, setTheme } = useTheme()
  const [themeMounted, setThemeMounted] = useState(false)
  const [profile, setProfile] = useState<{ displayName: string; email: string } | null>(null)

  useEffect(() => {
    setThemeMounted(true)
    void authApi.session().then((session) => setProfile(session.user)).catch((error) => {
      setProfile(null)
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace("/login")
      }
    })
  }, [router])

  async function logout() {
    try {
      await authApi.logout()
      router.replace('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout request failed', error)
      toast.error('No pudimos cerrar tu sesión. Inténtalo de nuevo.')
    }
  }

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
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar p-3 transition-[transform,width] duration-200 lg:translate-x-0 ${collapsed ? "lg:w-20" : ""} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <Link
            className="flex min-w-0 items-center gap-3"
            href="/portal/dashboard"
            onClick={() => setMobileOpen(false)}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              Z
            </span>
            {collapsed ? null : (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">Zapi Social</span>
                <span className="block text-xs text-muted-foreground">Portal</span>
              </span>
            )}
          </Link>
          <Button
            aria-label="Contraer navegación"
            className="hidden lg:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
            size="icon"
            variant="ghost"
          >
            {collapsed ? <ChevronRight /> : <PanelLeftClose />}
          </Button>
        </div>

        <ScrollArea className="-mr-2 mt-5 min-h-0 flex-1">
          <nav aria-label="Navegación del portal" className="flex flex-col gap-5 pb-3 pr-3">
            {portalNavigationGroups.map((group) => (
              <section key={group.label} aria-label={group.label} className="space-y-1">
                {collapsed ? null : (
                  <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const children = "children" in item ? item.children : undefined
                  const hasActiveChild = children?.some((child) =>
                    isPortalNavigationItemActive(child, pathname),
                  )
                  const active = isPortalNavigationItemActive(item, pathname) || hasActiveChild
                  const expanded = expandedItems[item.label] ?? hasActiveChild ?? false
                  const Icon = item.icon

                  return (
                    <div key={item.label} className="space-y-1">
                      {"href" in item ? (
                        <Button
                          asChild
                          className="w-full justify-start"
                          variant={active ? "sidebar-active" : "sidebar"}
                        >
                          <Link
                            aria-current={active ? "page" : undefined}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                          >
                            {Icon ? <Icon /> : null}
                            {collapsed ? null : <span>{item.label}</span>}
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          aria-expanded={expanded}
                          className="w-full justify-start"
                          onClick={() => {
                            if (collapsed) {
                              setCollapsed(false)
                            }

                            setExpandedItems((current) => ({
                              ...current,
                              [item.label]: !expanded,
                            }))
                          }}
                          variant={active ? "sidebar-active" : "sidebar"}
                        >
                          {Icon ? <Icon /> : null}
                          {collapsed ? null : <span>{item.label}</span>}
                          <ChevronDown
                            className={`ml-auto transition-transform ${expanded ? "rotate-180" : ""}`}
                          />
                        </Button>
                      )}

                      {collapsed || !children || !expanded ? null : (
                        <div className="ml-7 space-y-0.5 border-l border-border pl-2">
                          {children.map((child) => {
                            const childActive = isPortalNavigationItemActive(child, pathname)

                            return (
                              <Button
                                asChild
                                className="w-full justify-start"
                                key={child.href}
                                size="sm"
                                variant={childActive ? "sidebar-active" : "sidebar"}
                              >
                                <Link
                                  aria-current={childActive ? "page" : undefined}
                                  href={child.href}
                                  onClick={() => setMobileOpen(false)}
                                >
                                  {child.label}
                                </Link>
                              </Button>
                            )
                          })}
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

      <div className={`min-h-dvh transition-[padding] duration-200 ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              aria-label="Abrir navegación"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              size="icon"
              variant="ghost"
            >
              <Menu />
            </Button>
            <div>
              <p className="text-xs text-muted-foreground">Portal</p>
              <h1 className="text-sm font-semibold">{currentItem?.label ?? "Portal"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button aria-label="Notificaciones" size="icon" variant="ghost">
              <Bell />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label="Abrir menú de cuenta" className="size-8 rounded-full p-0" variant="ghost">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {profile?.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() ?? 'Z'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="grid gap-0.5">
                  <span className="font-medium">{profile?.displayName ?? 'Cuenta Zapi'}</span>
                  <span className="text-xs font-normal text-muted-foreground">{profile?.email ?? ''}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1 h-px bg-border" />
                <DropdownMenuItem className="justify-between" onSelect={(event) => event.preventDefault()}>
                  <span className="flex items-center gap-2">
                    {themeMounted && resolvedTheme === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
                    Tema oscuro
                  </span>
                  <Switch
                    aria-label="Alternar modo oscuro"
                    checked={themeMounted && resolvedTheme === "dark"}
                    disabled={!themeMounted}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  />
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 h-px bg-border" />
                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={() => void logout()}>
                  <LogOut aria-hidden="true" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
