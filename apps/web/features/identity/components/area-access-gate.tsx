"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { ShieldAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type ReactNode } from "react"

import {
  getAreaDestination,
  getSessionArea,
  type AreaAuthSession,
  type ProductArea,
} from "@/features/identity/session-area"

type AccessState =
  | { status: "loading" }
  | { status: "ready"; session: AreaAuthSession }
  | { status: "redirecting"; destination: string }
  | { status: "error"; message: string }

type AreaAccessGateProps = {
  area: ProductArea
  children: (session: AreaAuthSession) => ReactNode
}

const areaLabels: Record<ProductArea, string> = {
  admin: "Administración de plataforma",
  portal: "Portal",
}

function AccessLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-7xl items-center p-4 sm:p-6 lg:p-8" aria-busy="true">
      <Card variant="surface" className="w-full max-w-lg gap-5 py-6">
        <div className="space-y-3 px-6">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </Card>
    </main>
  )
}

export function AreaAccessGate({ area, children }: AreaAccessGateProps) {
  const router = useRouter()
  const [state, setState] = useState<AccessState>({ status: "loading" })

  const validateSession = useCallback(async () => {
    setState({ status: "loading" })

    try {
      const session = await authApi.session()
      const sessionArea = getSessionArea(session)

      if (!sessionArea) {
        setState({
          status: "error",
          message: "Tu sesión no incluye el área de acceso requerida. Vuelve a iniciar sesión.",
        })
        return
      }

      if (sessionArea !== area) {
        setState({
          status: "redirecting",
          destination: getAreaDestination(sessionArea),
        })
        return
      }

      setState({ status: "ready", session: session as AreaAuthSession })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setState({ status: "redirecting", destination: "/login" })
        return
      }

      setState({
        status: "error",
        message: "No pudimos validar tu acceso. Comprueba tu conexión e inténtalo de nuevo.",
      })
    }
  }, [area])

  useEffect(() => {
    void validateSession()
  }, [validateSession])

  useEffect(() => {
    if (state.status === "redirecting") {
      router.replace(state.destination)
    }
  }, [router, state])

  if (state.status === "loading") return <AccessLoading />

  if (state.status === "redirecting") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-7xl items-center p-4 sm:p-6 lg:p-8">
        <Card variant="surface" className="w-full max-w-lg">
          <EmptyState
            icon={ShieldAlert}
            title="Redirigiendo a tu área"
            description={`Esta cuenta solo tiene acceso a ${areaLabels[area === "admin" ? "portal" : "admin"]}.`}
          />
        </Card>
      </main>
    )
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-7xl items-center p-4 sm:p-6 lg:p-8">
        <Card variant="surface" className="w-full max-w-lg">
          <EmptyState
            icon={ShieldAlert}
            title="No pudimos verificar tu acceso"
            description={state.message}
            action={<Button onClick={() => void validateSession()}>Reintentar</Button>}
          />
        </Card>
      </main>
    )
  }

  return children(state.session)
}
