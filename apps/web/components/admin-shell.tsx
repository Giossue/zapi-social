"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Menu, PlugZap, ShieldCheck } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { AccountMenu } from "@/components/account-menu"

const adminNavigation = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/integrations", label: "Integraciones", icon: PlugZap },
] as const

const adminPageLabels: Record<string, string> = {
  "/admin": "Resumen",
  "/admin/integrations": "Integraciones",
}

type AdminShellProps = {
  children: React.ReactNode
  profile: {
    displayName: string
    email: string
  }
}

export function AdminShell({ children, profile }: AdminShellProps) {
  const pathname = usePathname()
  const pageLabel = adminPageLabels[pathname] ?? "Administración"

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <Link className="flex items-center gap-3 px-2 py-2" href="/admin">
          <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">Z</span>
          <span>
            <span className="block text-sm font-semibold">Zapi Social</span>
            <span className="block text-xs text-muted-foreground">Plataforma</span>
          </span>
        </Link>
        <nav className="mt-6 space-y-1" aria-label="Navegación administrativa">
          {adminNavigation.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
            const Icon = item.icon
            return (
              <Button asChild className="w-full justify-start" key={item.href} variant={active ? "sidebar-active" : "sidebar"}>
                <Link aria-current={active ? "page" : undefined} href={item.href}>
                  <Icon />
                  {item.label}
                </Link>
              </Button>
            )
          })}
        </nav>
      </aside>
      <div className="min-h-dvh lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 sm:px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <Button asChild aria-label="Abrir resumen administrativo" className="lg:hidden" size="icon" variant="ghost">
              <Link href="/admin"><Menu /></Link>
            </Button>
            <div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />Plataforma</p>
              <h1 className="text-sm font-semibold">{pageLabel}</h1>
            </div>
          </div>
          <AccountMenu profile={profile} />
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
