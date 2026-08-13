"use client"

import { channelConnectionsApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { CircleAlert, QrCode, RefreshCw, Smartphone } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { PortalChannelAccount } from "../types/channels"

type Connection = Awaited<
  ReturnType<typeof channelConnectionsApi.startWhatsAppStatus>
>

function toPortalAccount(
  account: NonNullable<
    Awaited<ReturnType<typeof channelConnectionsApi.status>>["account"]
  >
): PortalChannelAccount {
  return {
    id: account.id,
    capabilityKey: account.capabilityKey,
    provider: account.provider,
    displayName: account.displayName,
    externalName: account.externalName,
    handle: account.handle ?? undefined,
    avatarUrl: account.avatarUrl,
    status: account.status,
    connectedAt: account.createdAt,
  }
}

function remainingSeconds(expiresAt: string) {
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1_000)
  )
}

function countdownLabel(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
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
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const completedConnectionId = useRef<string | null>(null)
  const refreshingConnectionId = useRef<string | null>(null)
  const imageRefreshAttempts = useRef(0)

  const refresh = useCallback(async (connectionId: string) => {
    if (refreshingConnectionId.current === connectionId) return
    refreshingConnectionId.current = connectionId
    setIsStarting(true)
    setError(false)
    setErrorCode(null)
    try {
      setConnection(
        await channelConnectionsApi.refreshWhatsAppStatusQr(connectionId)
      )
    } catch (refreshError) {
      console.error("WhatsApp QR refresh failed", refreshError)
      setError(true)
      toast.error("No pudimos actualizar el código QR. Inténtalo de nuevo.")
    } finally {
      refreshingConnectionId.current = null
      setIsStarting(false)
    }
  }, [])

  const start = useCallback(async () => {
    setIsStarting(true)
    setError(false)
    setErrorCode(null)
    try {
      setConnection(
        await channelConnectionsApi.startWhatsAppStatus(
          reconnectAccountId ? { reconnectAccountId } : {}
        )
      )
    } catch (startError) {
      console.error("WhatsApp QR start failed", startError)
      setError(true)
      toast.error("No pudimos generar el código QR. Inténtalo de nuevo.")
    } finally {
      setIsStarting(false)
    }
  }, [reconnectAccountId])

  useEffect(() => {
    void start()
  }, [start])

  const connectionId = connection?.connection.id
  const expiresAt = connection?.connection.expiresAt

  useEffect(() => {
    if (!connectionId || !expiresAt) {
      setSecondsLeft(null)
      return
    }

    const updateCountdown = () => setSecondsLeft(remainingSeconds(expiresAt))
    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1_000)
    return () => window.clearInterval(timer)
  }, [connectionId, expiresAt])

  useEffect(() => {
    if (!connectionId || !expiresAt) return
    const refreshDelay = Math.max(
      0,
      new Date(expiresAt).getTime() - Date.now() - 3_000
    )
    const timer = window.setTimeout(
      () => void refresh(connectionId),
      refreshDelay
    )
    return () => window.clearTimeout(timer)
  }, [connectionId, expiresAt, refresh])

  useEffect(() => {
    if (!connection) return
    let active = true
    const poll = async () => {
      try {
        const result = await channelConnectionsApi.status(
          connection.connection.id
        )
        if (!active) return
        if (result.account) {
          completedConnectionId.current = connection.connection.id
          await onConnected(toPortalAccount(result.account))
          toast.success("Estados de WhatsApp conectados.")
          return
        }
        if (result.connection.state === "expired") {
          void refresh(connection.connection.id)
          return
        }
        if (
          ["failed", "cancelled"].includes(result.connection.state) ||
          result.publicError
        ) {
          setConnection(null)
          setErrorCode(result.publicError?.code ?? null)
          setError(true)
          toast.error(
            "No pudimos completar la conexión con WhatsApp. Genera un QR nuevo."
          )
        }
      } catch (pollError) {
        console.error("WhatsApp QR status failed", pollError)
        if (active) setError(true)
      }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 3_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [connection, onConnected, refresh])

  useEffect(() => {
    if (!connectionId) return
    return () => {
      if (completedConnectionId.current !== connectionId) {
        void channelConnectionsApi.cancel(connectionId).catch(() => undefined)
      }
    }
  }, [connectionId])

  if (isStarting && !connection) {
    return (
      <Card variant="inset">
        <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
          <Spinner aria-label="Generando código QR" />
          Generando un QR de un solo uso…
        </CardContent>
      </Card>
    )
  }

  if (connection) {
    const expiresIn =
      secondsLeft ?? remainingSeconds(connection.connection.expiresAt)
    const qrSource = `/api${connection.qrEndpoint}?v=${encodeURIComponent(connection.connection.expiresAt)}`
    return (
      <Card variant="inset">
        <CardContent className="grid justify-items-center gap-4 py-5 text-center">
          <img
            alt="Código QR para conectar Estados de WhatsApp"
            className="size-52 rounded-lg border border-border bg-card object-contain p-2"
            onError={() => {
              if (imageRefreshAttempts.current >= 1) {
                setError(true)
                return
              }
              imageRefreshAttempts.current += 1
              void refresh(connection.connection.id)
            }}
            onLoad={() => {
              imageRefreshAttempts.current = 0
            }}
            src={qrSource}
          />
          <div>
            <p className="flex items-center justify-center gap-2 font-medium">
              <QrCode aria-hidden="true" className="size-4 text-primary" />
              Escanea el QR desde WhatsApp
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              En WhatsApp abre Dispositivos vinculados y confirma la conexión.
            </p>
            <p
              aria-live="polite"
              className="mt-2 text-sm text-muted-foreground"
            >
              {isStarting
                ? "Actualizando QR…"
                : `Este QR se actualiza en ${countdownLabel(expiresIn)}.`}
            </p>
          </div>
          <Button
            disabled={isStarting}
            onClick={() => void refresh(connection.connection.id)}
            type="button"
            variant="brand-secondary"
          >
            {isStarting ? (
              <Spinner
                aria-label="Actualizando código QR"
                data-icon="inline-start"
              />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Generar otro QR
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      <Card variant="inset">
        <CardContent className="flex items-start gap-3 py-5">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 text-warning"
          />
          <div className="grid gap-1">
            <p className="font-medium">
              {errorCode === "WHATSAPP_ACCOUNT_MISMATCH"
                ? "El teléfono escaneado no corresponde a este canal"
                : error
                  ? "El QR expiró o el conector no respondió"
                  : "Preparar vínculo por QR"}
            </p>
            <p className="text-sm text-muted-foreground">
              {errorCode === "WHATSAPP_ACCOUNT_MISMATCH"
                ? "Escanea el teléfono original o cierra este diálogo para conectar el otro teléfono como un canal nuevo."
                : "Genera un QR nuevo para continuar con la conexión."}
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button
          disabled={isStarting}
          onClick={() => void start()}
          type="button"
        >
          {isStarting ? (
            <Spinner
              aria-label="Generando código QR"
              data-icon="inline-start"
            />
          ) : (
            <Smartphone data-icon="inline-start" />
          )}
          Generar QR
        </Button>
      </div>
    </div>
  )
}
