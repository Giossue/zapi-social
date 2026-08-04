"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, RefreshCw } from "lucide-react"
import { auditApi, ApiError } from "@workspace/api-client"
import type { AdminAuditEvent } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

const sourceLabels = { web: "Web", api: "API", worker: "Worker" } as const
const severityVariant = { success: "success", warning: "warning", error: "destructive" } as const

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

export function AuditEventsPage() {
  const [events, setEvents] = useState<AdminAuditEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await auditApi.list()
      setEvents(response.events)
    } catch (caught) {
      setError(caught instanceof ApiError ? "No se pudo cargar la auditoría." : "No se pudo cargar la auditoría.")
      setEvents([])
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <section className="space-y-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Auditoría</h2>
          <p className="text-sm text-muted-foreground">Actividad registrada por Web, API y Worker.</p>
        </div>
        <Button onClick={() => void load()} variant="brand-secondary">
          <RefreshCw data-icon="inline-start" /> Actualizar
        </Button>
      </div>
      {events === null ? <PageLoading /> : error ? <Card variant="subtle"><EmptyState icon={Activity} title="Auditoría no disponible" description={error} action={<Button onClick={() => void load()} variant="brand-secondary">Reintentar</Button>} /></Card> : events.length === 0 ? <Card variant="subtle"><EmptyState icon={Activity} title="Aún no hay eventos" description="Las acciones de Web, API y Worker aparecerán aquí cuando se registren." /></Card> : (
        <Card className="overflow-hidden p-0" variant="subtle">
          <Table>
            <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>Origen</TableHead><TableHead>Estado</TableHead><TableHead>Cuenta</TableHead><TableHead>Espacio</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
            <TableBody>{events.map((item) => <TableRow key={`${item.source}-${item.id}`}><TableCell className="max-w-64 truncate font-medium" title={item.summary ?? item.event}>{item.event}</TableCell><TableCell>{sourceLabels[item.source]}</TableCell><TableCell><Badge variant={severityVariant[item.severity]}>{item.severity}</Badge></TableCell><TableCell>{item.actorName ?? item.actorEmail ?? "Sistema"}</TableCell><TableCell>{item.workspaceName ?? "—"}</TableCell><TableCell className="text-muted-foreground">{formatDate(item.createdAt)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Card>
      )}
    </section>
  )
}
