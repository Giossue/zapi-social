import type { ReactNode } from "react"

import { Sparkles } from "lucide-react"

import { AuthForm, type AuthMode } from "./auth-form"

type AuthShellProps = {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="min-h-svh bg-background p-2 text-foreground">
      <div className="grid min-h-[calc(100svh-1rem)] overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 lg:grid-cols-2">
        <aside className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.12em] uppercase">
              <Sparkles aria-hidden="true" className="size-4" />
              Zapi
            </div>
            <p className="text-sm text-primary-foreground/80">
              Gestión social, sin ruido.
            </p>
          </div>
          <div className="max-w-md space-y-5">
            <p className="text-sm font-medium">Acceso Zapi</p>
            <h1 className="font-heading text-4xl font-semibold tracking-tight">
              Planifica, publica y mide desde un solo lugar.
            </h1>
            <p className="text-base leading-relaxed text-primary-foreground/80">
              Gestiona contenido, canales y aprobaciones con tu equipo.
            </p>
          </div>
          <div className="text-sm text-primary-foreground/80">
            Tu espacio de trabajo, siempre conectado.
          </div>
        </aside>
        <section className="flex min-w-0 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-2 lg:hidden">
              <Sparkles aria-hidden="true" className="size-4 text-primary" />
              <div>
                <p className="text-sm font-semibold tracking-[0.12em] uppercase">
                  Zapi
                </p>
                <p className="text-sm text-muted-foreground">
                  Gestión social, sin ruido.
                </p>
              </div>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}

export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  return (
    <AuthShell>
      <AuthForm initialMode={initialMode} />
    </AuthShell>
  )
}
