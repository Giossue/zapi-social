import Link from 'next/link'
import { Blocks, LayoutDashboard, PlugZap } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-sidebar-border bg-sidebar p-3 lg:flex lg:flex-col">
        <Link className="flex items-center gap-3 px-2 py-2" href="/admin/integrations">
          <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">Z</span>
          <span>
            <span className="block text-sm font-semibold">Zapi Social</span>
            <span className="block text-xs text-muted-foreground">Administración</span>
          </span>
        </Link>
        <nav className="mt-6 space-y-1" aria-label="Navegación administrativa">
          <Button asChild className="w-full justify-start" variant="sidebar">
            <Link href="/admin/integrations"><LayoutDashboard />Resumen</Link>
          </Button>
          <Button asChild className="w-full justify-start" variant="sidebar-active">
            <Link href="/admin/integrations"><PlugZap />Integraciones</Link>
          </Button>
        </nav>
      </aside>
      <div className="min-h-dvh lg:pl-64">
        <header className="flex h-16 items-center border-b border-sidebar-border bg-sidebar px-5 lg:px-8">
          <div>
            <p className="text-xs text-muted-foreground">Administración</p>
            <h1 className="text-sm font-semibold">Integraciones</h1>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
