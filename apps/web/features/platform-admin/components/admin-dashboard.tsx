import Link from "next/link"
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  PlugZap,
  TriangleAlert,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { adminDashboardFixture } from "../fixtures/dashboard"

const metricIcons = [PlugZap, TriangleAlert, Activity] as const

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <section className="max-w-2xl space-y-2">
        <p className="text-sm font-medium text-primary">
          Administración de plataforma
        </p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Control operativo de Zapi
        </h2>
        <p className="text-muted-foreground">
          Supervisa la configuración global sin entrar en los workspaces de
          clientes.
        </p>
      </section>

      <section
        className="grid gap-4 md:grid-cols-3"
        aria-label="Estado de la plataforma"
      >
        {adminDashboardFixture.metrics.map((metric, index) => {
          const Icon = metricIcons[index] ?? Activity
          return (
            <Card key={metric.label} variant="subtle">
              <CardHeader className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <CardDescription>{metric.label}</CardDescription>
                  <Icon
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                </div>
                <CardTitle className="text-2xl">{metric.value}</CardTitle>
                <CardDescription>{metric.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Atención operativa</CardTitle>
            <CardDescription>
              Prioridades de configuración global. Datos de muestra mientras se
              conecta el módulo administrativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {adminDashboardFixture.activity.map((item) => {
              const isHealthy = item.status === "healthy"
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0"
                >
                  {isHealthy ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-success"
                    />
                  ) : (
                    <TriangleAlert
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-warning"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Badge variant={isHealthy ? "success" : "warning"}>
                    {isHealthy ? "Correcto" : "Revisar"}
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Acceso rápido</CardTitle>
            <CardDescription>
              Gestiona los proveedores que habilitan los canales para todos los
              clientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/integrations">
                <PlugZap data-icon="inline-start" />
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
