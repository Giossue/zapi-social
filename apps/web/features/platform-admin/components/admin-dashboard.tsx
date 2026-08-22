"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  PlugZap,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"

import { ApiError, integrationsApi, polarApi } from "@workspace/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { CardGrid } from "@workspace/ui/components/card-grid"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { Separator } from "@workspace/ui/components/separator"
import { loginPath } from "@/features/identity/login-redirect"

type Readiness = "ready" | "incomplete" | "untested" | "disabled"

type ProviderState = {
  label: string
  readiness: Readiness
}

const readinessCopy: Record<Readiness, { label: string; detail: string }> = {
  ready: { label: "Listo", detail: "Disponible para los workspaces." },
  incomplete: {
    label: "Incompleto",
    detail: "Faltan credenciales por completar.",
  },
  untested: {
    label: "Sin probar",
    detail: "Configurado, pero sin una prueba de conexión correcta.",
  },
  disabled: {
    label: "Deshabilitado",
    detail: "No se ofrece a los workspaces.",
  },
}

export function AdminDashboard() {
  const router = useRouter()
  const [providers, setProviders] = useState<ProviderState[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const [meta, whatsapp, smtp, drive, polar] = await Promise.all([
        integrationsApi.getMeta(),
        integrationsApi.getWhatsAppStatus(),
        integrationsApi.getEmailSmtp(),
        integrationsApi.getGoogleDrive(),
        polarApi.get(),
      ])
      setProviders([
        { label: "Meta", readiness: meta.readiness },
        { label: "WhatsApp Status", readiness: whatsapp.readiness },
        { label: "Correo SMTP", readiness: smtp.readiness },
        { label: "Google Drive", readiness: drive.readiness },
        { label: "Polar.sh", readiness: polar.readiness },
      ])
      setForbidden(false)
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace(loginPath())
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error("Admin dashboard request failed", error)
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
            description="Solicita a un administrador el permiso necesario para ver el estado de la plataforma."
            icon={ShieldCheck}
            title="Panel no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !providers) {
    return <PageLoading aria-label="Cargando estado de la plataforma" />
  }

  if (loadError || !providers) {
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
            description="No pudimos consultar el estado de los proveedores."
            icon={CircleAlert}
            title="Panel no disponible"
          />
        </CardContent>
      </Card>
    )
  }

  const ready = providers.filter((provider) => provider.readiness === "ready")
  const attention = providers.filter(
    (provider) =>
      provider.readiness === "incomplete" || provider.readiness === "untested"
  )
  const disabled = providers.filter(
    (provider) => provider.readiness === "disabled"
  )

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <section aria-label="Estado de la plataforma">
        <CardGrid layout="md-3">
          <MetricCard
            description="Disponibles para los workspaces"
            icon={CheckCircle2}
            label="Proveedores listos"
            value={`${ready.length}/${providers.length}`}
          />
          <MetricCard
            description="Credenciales o pruebas pendientes"
            icon={TriangleAlert}
            label="Requieren atención"
            value={attention.length}
          />
          <MetricCard
            description="No se ofrecen a los workspaces"
            icon={Activity}
            label="Deshabilitados"
            value={disabled.length}
          />
        </CardGrid>
      </section>

      <section
        aria-label="Operación de plataforma"
        className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]"
      >
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Atención operativa</CardTitle>
            <CardDescription>
              Proveedores que aún no están disponibles para los workspaces.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {attention.length ? (
                attention.map((provider, index) => (
                  <div className="flex flex-col gap-3" key={provider.label}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-start gap-3">
                      <TriangleAlert
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-warning"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{provider.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {readinessCopy[provider.readiness].detail}
                        </p>
                      </div>
                      <Badge variant="warning">
                        {readinessCopy[provider.readiness].label}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-success"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Sin configuraciones pendientes
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Todos los proveedores configurados superaron su prueba de
                      conexión.
                    </p>
                  </div>
                  <Badge variant="success">Correcto</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Integraciones</CardTitle>
            <CardDescription>
              Gestiona los proveedores que habilitan los canales para todos los
              clientes.
            </CardDescription>
            <CardAction>
              <PlugZap
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Revisa las configuraciones incompletas antes de habilitarlas para
              los workspaces.
            </p>
            <Button asChild size="sm" variant="brand-secondary">
              <Link href="/admin/integrations">
                Administrar integraciones
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
