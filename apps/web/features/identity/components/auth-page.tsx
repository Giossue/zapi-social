import type { ReactNode } from "react"

import { Globe } from "lucide-react"
import Link from "next/link"

import { AuthForm, type AuthMode } from "./auth-form"

type AuthShellProps = {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main>
      <div className="relative flex h-dvh w-full items-center justify-center p-2">
        {children}
      </div>
    </main>
  )
}

export function AuthPage({
  initialMode,
  returnTo,
}: {
  initialMode: AuthMode
  returnTo?: string
}) {
  const isLogin = initialMode === "login"
  const alternatePath = isLogin ? "/register" : "/login"
  const alternateHref = returnTo
    ? `${alternatePath}?returnTo=${encodeURIComponent(returnTo)}`
    : alternatePath

  return (
    <AuthShell>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-medium">
            {isLogin ? "Inicia sesión en tu cuenta" : "Crea tu cuenta"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLogin
              ? "Ingresa tus datos para continuar."
              : "Ingresa tus datos para comenzar."}
          </p>
        </div>
        <AuthForm initialMode={initialMode} returnTo={returnTo} />
      </div>

      <div className="absolute top-5 flex w-full justify-end px-10">
        <div className="text-sm text-muted-foreground">
          {isLogin ? "¿No tienes una cuenta? " : "¿Ya tienes una cuenta? "}
          <Link
            className="text-foreground"
            href={alternateHref}
            prefetch={false}
          >
            {isLogin ? "Crear cuenta" : "Iniciar sesión"}
          </Link>
        </div>
      </div>

      <div className="absolute bottom-5 flex w-full justify-between px-10">
        <div className="text-sm">© {new Date().getFullYear()} Zapi Social</div>
        <div className="flex items-center gap-1 text-sm">
          <Globe aria-hidden="true" className="size-4 text-muted-foreground" />
          ESP
        </div>
      </div>
    </AuthShell>
  )
}
