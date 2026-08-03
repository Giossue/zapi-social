"use client"

import { ApiError, portalApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { toast } from "@workspace/ui/components/toast"
import { TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { DashboardLoading } from "./dashboard-loading"
import { PortalDashboardPage } from "./dashboard-page"
import type { PortalDashboard } from "../types/dashboard"

export function LivePortalDashboard() {
  const router = useRouter()
  const [dashboard, setDashboard] = useState<PortalDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)

    try {
      const nextDashboard = await portalApi.dashboard()
      setDashboard(nextDashboard)
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace("/login")
        return
      }

      console.error("Dashboard request failed", error)
      toast.error("No pudimos cargar tu dashboard. Inténtalo de nuevo.")
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  if (isLoading) return <DashboardLoading />

  if (hasError || !dashboard) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="No pudimos cargar el dashboard"
        description="Comprueba tu conexión e inténtalo de nuevo."
        action={
          <Button onClick={() => void loadDashboard()}>Reintentar</Button>
        }
      />
    )
  }

  return <PortalDashboardPage dashboard={dashboard} />
}
