"use client"

import { channelConnectionsApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { toast } from "@workspace/ui/components/toast"
import { CheckCircle2, CircleAlert, LoaderCircle, QrCode, RefreshCw, Smartphone } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { PortalChannelAccount } from "../types/channels"

type Connection = Awaited<ReturnType<typeof channelConnectionsApi.startWhatsAppStatus>>

function toPortalAccount(account: NonNullable<Awaited<ReturnType<typeof channelConnectionsApi.status>>["account"]>): PortalChannelAccount {
  return {
    id: account.id,
    capabilityKey: account.capabilityKey,
    provider: account.provider,
    displayName: account.displayName,
    externalName: account.externalName,
    handle: account.handle ?? undefined,
    avatarUrl: account.avatarUrl,
    status: account.status,
    connectedAt: account.createdAt.slice(0, 10),
  }
}

export function WhatsAppStatusConnection({
  reconnectAccountId,
  onConnected,
}: {
  reconnectAccountId?: string
  onConnected: (account: PortalChannelAccount) => Promise<void>
}) {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [error, setError] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const completedConnectionId = useRef<string | null>(null)

  const start = useCallback(async () => {
    setIsStarting(true)
    setError(false)
    try {
      setConnection(await channelConnectionsApi.startWhatsAppStatus(reconnectAccountId ? { reconnectAccountId } : {}))
    } catch (error) {
      console.error("WhatsApp QR start failed", error)
      setError(true)
      toast.error("No pudimos generar el código QR. Inténtalo de nuevo.")
    } finally {
      setIsStarting(false)
    }
  }, [reconnectAccountId])

  useEffect(() => {
    void start()
  }, [start])

  useEffect(() => {
    if (!connection) return
    let active = true
    const poll = async () => {
      try {
        const result = await channelConnectionsApi.status(connection.connection.id)
        if (!active) return
        if (result.account) {
          completedConnectionId.current = connection.connection.id
          await onConnected(toPortalAccount(result.account))
          toast.success("Estados de WhatsApp conectados.")
          return
        }
        if (['expired', 'failed', 'cancelled'].includes(result.connection.state) || result.publicError) {
          setConnection(null)
          setError(true)
          return
        }
      } catch (error) {
        console.error("WhatsApp QR status failed", error)
        if (active) setError(true)
      }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 3_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [connection, onConnected])

  useEffect(() => {
    if (!connection) return
    const connectionId = connection.connection.id
    return () => {
      if (completedConnectionId.current !== connectionId) {
        void channelConnectionsApi.cancel(connectionId).catch(() => undefined)
      }
    }
  }, [connection])

  if (isStarting && !connection) {
    return <Card variant="inset"><CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />Generando un QR de un solo uso…</CardContent></Card>
  }

  if (connection) {
    return (
      <Card variant="inset">
        <CardContent className="grid justify-items-center gap-4 py-5 text-center">
          <img alt="Código QR para conectar Estados de WhatsApp" className="size-52 rounded-lg border border-border bg-card object-contain p-2" src={`/api${connection.qrEndpoint}`} />
          <div>
            <p className="flex items-center justify-center gap-2 font-medium"><QrCode aria-hidden="true" className="size-4 text-primary" />Escanea el QR desde WhatsApp</p>
            <p className="mt-1 text-sm text-muted-foreground">En WhatsApp abre Dispositivos vinculados y confirma la conexión.</p>
          </div>
          <Button disabled={isStarting} onClick={() => void start()} type="button" variant="brand-secondary"><RefreshCw data-icon="inline-start" />Generar otro QR</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      <Card variant="inset"><CardContent className="flex items-start gap-3 py-5"><CircleAlert aria-hidden="true" className="mt-0.5 size-5 text-warning" /><div className="grid gap-1"><p className="font-medium">{error ? "El QR expiró o el conector no respondió" : "Preparar vínculo por QR"}</p><p className="text-sm text-muted-foreground">Genera un QR nuevo para continuar con la conexión.</p></div></CardContent></Card>
      <div className="flex justify-end"><Button disabled={isStarting} onClick={() => void start()} type="button"><Smartphone data-icon="inline-start" />Generar QR</Button></div>
    </div>
  )
}
