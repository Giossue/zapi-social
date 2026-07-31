import { AuthForm, type AuthMode } from "./auth-form"

export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-border px-5 sm:px-8">
        <span className="text-sm font-semibold tracking-[0.12em] text-primary uppercase">
          Zapi
        </span>
        <p className="text-sm text-muted-foreground">
          Gestión social, sin ruido.
        </p>
      </header>
      <section className="grid min-h-[calc(100svh-4rem)] place-items-center px-4 py-10 sm:px-6">
        <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
          <div className="hidden max-w-md space-y-5 lg:block">
            <p className="text-sm font-medium text-primary">Acceso Zapi</p>
            <h1 className="text-4xl font-semibold tracking-tight">
              Planifica, publica y mide desde un solo lugar.
            </h1>
            <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
              Gestiona contenido, canales y aprobaciones con tu equipo.
            </p>
          </div>
          <div className="w-full">
            <AuthForm initialMode={initialMode} />
          </div>
        </div>
      </section>
    </main>
  )
}
