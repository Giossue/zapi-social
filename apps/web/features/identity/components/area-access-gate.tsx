"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { Card } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"

import { RetryButton } from "@workspace/ui/components/retry-button"
import { ShieldAlert } from "lucide-react"
import { useTranslations } from "next-intl"
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
  childrenAction: (session: AreaAuthSession | null) => ReactNode
}

export function AreaAccessGate({ area, childrenAction }: AreaAccessGateProps) {
  const t = useTranslations("auth.access")
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
      setState({ status: "error", message: t("accessCheckFailed") })
    }
  }, [area, redirect, t])

  useEffect(() => {
    const timer = setTimeout(() => void validateSession(), 0)
    return () => clearTimeout(timer)
  }, [validateSession])

  if (state.status === "loading") return childrenAction(null)
  if (state.status === "error") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-7xl items-center p-4 sm:p-6 lg:p-8">
        <Card variant="subtle" className="w-full max-w-lg">
          <EmptyState
            icon={ShieldAlert}
            title={t("accessCheckTitle")}
            description={state.message}
            action={<RetryButton onClick={() => void validateSession()} />}
          />
        </Card>
      </main>
    )
  }
  return childrenAction(state.session)
}
