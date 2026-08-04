"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@workspace/ui/components/page-loading"
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
  | { status: "error"; message: string }

type AreaAccessGateProps = {
  area: ProductArea
  children: (session: AreaAuthSession) => ReactNode
}

function AccessLoading() {
  return <PageLoading className="min-h-dvh bg-background" />
}

export function AreaAccessGate({ area, children }: AreaAccessGateProps) {
  const router = useRouter()
  const [state, setState] = useState<AccessState>({ status: "loading" })

  const redirect = useCallback(
    (destination: string) => {
      router.replace(destination)
      router.refresh()
    },
    [router]
  )

  const validateSession = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const session = await authApi.session()
      const sessionArea = getSessionArea(session)
      if (!sessionArea) {
        redirect("/login")
        return
      }
      if (sessionArea !== area) {
        redirect(getAreaDestination(sessionArea))
        return
      }
      setState({ status: "ready", session: session as AreaAuthSession })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirect("/login")
        return
      }
      setState({
        status: "error",
        message:
          "No pudimos validar tu acceso. Comprueba tu conexión e inténtalo de nuevo.",
      })
    }
  }, [area, redirect])

  useEffect(() => {
    void validateSession()
  }, [validateSession])

  if (state.status === "loading") return <AccessLoading />
  if (state.status === "error") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-7xl items-center p-4 sm:p-6 lg:p-8">
        <Card variant="surface" className="w-full max-w-lg">
          <EmptyState
            icon={ShieldAlert}
            title="No pudimos verificar tu acceso"
            description={state.message}
            action={
              <Button onClick={() => void validateSession()}>Reintentar</Button>
            }
          />
        </Card>
      </main>
    )
  }
  return children(state.session)
}
