"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  CircleAlert,
  Cpu,
  Database,
  ShieldCheck,
  XCircle,
} from "lucide-react"

import { ApiError, adminSystemApi } from "@workspace/api-client"
import type { AdminSystemInformation } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { Separator } from "@workspace/ui/components/separator"

function uptime(seconds: number) {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (days) return `${days} d ${hours} h`
  if (hours) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

export function SystemInformationPage() {
  const router = useRouter()
  const [data, setData] = useState<AdminSystemInformation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setData(await adminSystemApi.information())
      setForbidden(false)
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace("/login")
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error("System information request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description="Solicita a un administrador el permiso necesario para ver el estado del sistema."
            icon={ShieldCheck}
            title="Información no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !data) {
    return <PageLoading aria-label="Cargando información del sistema" />
  }

  if (loadError || !data) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton
                onClick={() => void load()}
                variant="brand-secondary"
              />
            }
            description="No pudimos consultar el estado de la plataforma."
            icon={CircleAlert}
            title="Información no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description="Runtime, dependencias y migraciones aplicadas en el entorno actual."
        title="Información del sistema"
      />

      <CardGrid layout="md-3">
        <MetricCard
          description="Entorno de ejecución"
          icon={Cpu}
          label="Entorno"
          value={data.environment}
        />
        <MetricCard
          description="Desde el último reinicio"
          icon={Cpu}
          label="Tiempo activo"
          value={uptime(data.uptimeSeconds)}
        />
        <MetricCard
          description="Registradas en la base"
          icon={Database}
          label="Migraciones"
          value={data.migrationsApplied}
        />
      </CardGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card variant="subtle">
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="font-medium">Dependencias</p>
            {data.services.map((service, index) => (
              <div className="flex flex-col gap-3" key={service.label}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-start gap-3">
                  {service.passed ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-success"
                    />
                  ) : (
                    <XCircle
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{service.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {service.detail}
                    </p>
                  </div>
                  <Badge variant={service.passed ? "success" : "destructive"}>
                    {service.passed ? "Disponible" : "Caído"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card variant="subtle">
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="font-medium">Runtime</p>
            {data.runtime.map((item, index) => (
              <div className="flex flex-col gap-3" key={item.label}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="font-mono text-sm">{item.value}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
