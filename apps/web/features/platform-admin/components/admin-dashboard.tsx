import Link from "next/link"
import type { LucideIcon } from "lucide-react"
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
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { Separator } from "@workspace/ui/components/separator"

import { adminDashboardFixture } from "../fixtures/dashboard"

const metricIcons: Record<string, LucideIcon> = {
  Actividad: Activity,
  Atención: TriangleAlert,
  Integraciones: PlugZap,
}

export function AdminDashboard() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <section aria-label="Estado de la plataforma">
        <div className="grid gap-3 md:grid-cols-3">
          {adminDashboardFixture.metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              {...metric}
              icon={metricIcons[metric.label] ?? Activity}
            />
          ))}
        </div>
      </section>

      <section
        className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]"
        aria-label="Operación de plataforma"
      >
        <Card variant="subtle">
          <CardHeader>
            <CardTitle>Atención operativa</CardTitle>
            <CardDescription>
              Prioridades de configuración global. Datos de muestra mientras se
              conecta el módulo administrativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {adminDashboardFixture.activity.map((item, index) => {
                const isHealthy = item.status === "healthy"

                return (
                  <div className="flex flex-col gap-3" key={item.title}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-start gap-3">
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
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <Badge variant={isHealthy ? "success" : "warning"}>
                        {isHealthy ? "Correcto" : "Revisar"}
                      </Badge>
                    </div>
                  </div>
                )
              })}
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
