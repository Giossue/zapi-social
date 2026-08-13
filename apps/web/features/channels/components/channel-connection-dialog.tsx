"use client"

import { channelConnectionsApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { CheckCircle2, ShieldCheck } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import type {
  ChannelCandidate,
  PortalChannelAccount,
  PortalChannelCapability,
} from "../types/channels"
import { ChannelCapabilityGrid } from "./channel-capability-picker"
import { WhatsAppStatusConnection } from "./whatsapp-status-connection"

type DialogStep =
  "capabilities" | "authorizing" | "picker" | "whatsapp" | "connected"

const providerLabels = {
  meta: "Meta",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
} as const

export type MetaPickerSession = {
  capability: PortalChannelCapability
  connectionId: string
  candidates: readonly ChannelCandidate[]
}

function candidateInitials(label: string) {
  return label
    .replace(/^@/, "")
    .split(/[.\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function CandidateAvatar({ candidate }: { candidate: ChannelCandidate }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-accent-foreground">
      <span aria-hidden="true">{candidateInitials(candidate.label)}</span>
      {candidate.avatarUrl ? (
        <img
          alt={`Avatar de ${candidate.label}`}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
          src={candidate.avatarUrl}
        />
      ) : null}
    </span>
  )
}

function toPortalAccount(
  account: Awaited<ReturnType<typeof channelConnectionsApi.select>>["account"]
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

export function ChannelConnectionDialog({
  capabilities,
  open,
  metaPickerSession,
  onConnected,
  onMetaAuthorizationStart,
  onMetaConnectionCompleted,
  onMetaConnectionCancelled,
  onWhatsAppConnectionCompleted,
  onOpenChange,
  whatsappReconnectAccountId,
}: {
  capabilities: readonly PortalChannelCapability[]
  open: boolean
  metaPickerSession: MetaPickerSession | null
  onConnected: (account: PortalChannelAccount) => void
  onMetaAuthorizationStart: (
    result: Awaited<ReturnType<typeof channelConnectionsApi.startMeta>>,
    capability: PortalChannelCapability
  ) => void
  onMetaConnectionCompleted: () => Promise<void>
  onMetaConnectionCancelled: () => void
  onWhatsAppConnectionCompleted: () => Promise<void>
  onOpenChange: (open: boolean) => void
  whatsappReconnectAccountId: string | null
}) {
  const [capability, setCapability] = useState<PortalChannelCapability | null>(
    null
  )
  const [candidate, setCandidate] = useState<ChannelCandidate | null>(null)
  const [step, setStep] = useState<DialogStep>("capabilities")
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)

  useEffect(() => {
    if (!whatsappReconnectAccountId || !open) return
    const whatsappCapability = capabilities.find(
      (item) => item.key === "whatsapp_status"
    )
    if (!whatsappCapability) return
    setCapability(whatsappCapability)
    setCandidate(null)
    setStep("whatsapp")
  }, [capabilities, open, whatsappReconnectAccountId])

  useEffect(() => {
    if (!metaPickerSession || !open) return
    setCapability(metaPickerSession.capability)
    setCandidate(null)
    setStep("picker")
  }, [metaPickerSession, open])

  function reset() {
    setCapability(null)
    setCandidate(null)
    setStep("capabilities")
    setIsAuthorizing(false)
    setIsSelecting(false)
  }

  useEffect(() => {
    if (!open) reset()
  }, [open])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  async function selectCapability(nextCapability: PortalChannelCapability) {
    setCapability(nextCapability)
    setCandidate(null)

    if (nextCapability.provider === "meta") {
      setIsAuthorizing(true)
      try {
        const result = await channelConnectionsApi.startMeta({
          capabilityKey: nextCapability.key,
        })
        onMetaAuthorizationStart(result, nextCapability)
      } catch (error) {
        console.error("Meta authorization start failed", error)
        toast.error(
          "No pudimos iniciar la autorización con Meta. Inténtalo de nuevo."
        )
        setStep("capabilities")
      } finally {
        setIsAuthorizing(false)
      }
      return
    }

    if (nextCapability.connectionKind === "qr_device") {
      setStep("whatsapp")
      return
    }
    setStep("authorizing")
  }

  function finishMockConnection(selected: ChannelCandidate) {
    if (!capability || capability.provider === "meta") return
    onConnected({
      id: `mock-${capability.key}-${selected.id}`,
      capabilityKey: capability.key,
      provider: capability.provider,
      displayName: selected.label,
      handle: selected.label.startsWith("@")
        ? selected.label.slice(1)
        : undefined,
      status: "connected",
      connectedAt: "2026-07-31",
    })
    setStep("connected")
    toast.success(`${capability.label} conectado en el mock.`)
  }

  function authorizeMock() {
    if (!capability || capability.provider === "meta") return
    if (capability.connectionKind === "picker") {
      setStep("picker")
      return
    }
    finishMockConnection({
      id: `${capability.key}-direct`,
      label: `Cuenta de ${providerLabels[capability.provider]}`,
      description: capability.label,
    })
  }

  async function selectMetaCandidate() {
    if (!candidate || !metaPickerSession) return
    setIsSelecting(true)
    try {
      const result = await channelConnectionsApi.select(
        metaPickerSession.connectionId,
        {
          candidateId: candidate.id,
        }
      )
      onConnected(toPortalAccount(result.account))
      await onMetaConnectionCompleted()
      toast.success(`${metaPickerSession.capability.label} conectado.`)
    } catch (error) {
      console.error("Meta candidate selection failed", error)
      toast.error(
        "No pudimos conectar la cuenta seleccionada. Inténtalo de nuevo."
      )
    } finally {
      setIsSelecting(false)
    }
  }

  async function cancelPicker() {
    if (capability?.provider === "meta") {
      if (!metaPickerSession) return
      setIsSelecting(true)
      try {
        await channelConnectionsApi.cancel(metaPickerSession.connectionId)
        onMetaConnectionCancelled()
        reset()
        onOpenChange(false)
        toast.success("La conexión con Meta fue cancelada.")
      } catch (error) {
        console.error("Meta connection cancellation failed", error)
        toast.error(
          "No pudimos cancelar la conexión con Meta. Inténtalo de nuevo."
        )
      } finally {
        setIsSelecting(false)
      }
      return
    }

    reset()
    onOpenChange(false)
  }

  function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!candidate || !capability) {
      toast.error("Selecciona una cuenta para continuar.")
      return
    }

    if (capability.provider === "meta") {
      if (!metaPickerSession) {
        toast.error(
          "No pudimos recuperar esta autorización. Inicia la conexión de nuevo."
        )
        return
      }
      void selectMetaCandidate()
      return
    }

    finishMockConnection(candidate)
  }

  const title = capability
    ? `Conectar ${capability.label}`
    : "Conectar un canal"
  const isMetaPicker = capability?.provider === "meta"
  const pickerCandidates = isMetaPicker
    ? (metaPickerSession?.candidates ?? [])
    : (capability?.candidates ?? [])

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {capability?.provider === "meta"
              ? "Autoriza Meta para ver y conectar los recursos elegibles de tu cuenta."
              : "Los conectores disponibles fuera de Meta permanecen en modo de referencia."}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100dvh-10rem)]">
          <div className="grid gap-4">
            {step === "capabilities" ? (
              <ChannelCapabilityGrid
                capabilities={capabilities}
                onSelect={(capability) => void selectCapability(capability)}
              />
            ) : null}

            {isAuthorizing ? (
              <Card variant="inset">
                <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
                  <Spinner aria-label="Preparando autorización con Meta" />
                  Preparando la autorización con Meta…
                </CardContent>
              </Card>
            ) : null}

            {step === "authorizing" && capability ? (
              <div className="grid gap-5">
                <Card variant="inset">
                  <CardContent className="flex items-start gap-3 py-5">
                    <ShieldCheck
                      aria-hidden="true"
                      className="mt-0.5 size-5 text-primary"
                    />
                    <div className="grid gap-1">
                      <p className="font-medium">
                        Autorización simulada de{" "}
                        {providerLabels[capability.provider]}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        En producción se abrirá el proveedor, se validará el
                        retorno y se mostrarán solo los recursos elegibles.
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-end">
                  <Button onClick={authorizeMock} type="button">
                    <ShieldCheck data-icon="inline-start" />
                    Simular autorización aceptada
                  </Button>
                </div>
              </div>
            ) : null}

            {step === "picker" && capability ? (
              <form
                aria-busy={isSelecting}
                className="grid gap-4"
                noValidate
                onSubmit={submitCandidate}
              >
                <Field>
                  <FieldLabel id="channel-candidate-label">
                    Cuenta disponible
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FieldLabel>
                  <div
                    aria-labelledby="channel-candidate-label"
                    aria-required="true"
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                    role="radiogroup"
                  >
                    {pickerCandidates.map((item) => (
                      <Button
                        aria-checked={candidate?.id === item.id}
                        className="h-auto justify-start gap-3 px-4 py-3 text-left whitespace-normal"
                        disabled={isSelecting}
                        key={item.id}
                        onClick={() => setCandidate(item)}
                        role="radio"
                        type="button"
                        variant={
                          candidate?.id === item.id
                            ? "brand-secondary"
                            : "surface"
                        }
                      >
                        <CandidateAvatar candidate={item} />
                        <span className="grid min-w-0 gap-0.5">
                          <span>{item.label}</span>
                          <span className="text-sm font-normal text-muted-foreground">
                            {item.description}
                          </span>
                          {item.metadata ? (
                            <span className="text-xs font-normal text-muted-foreground">
                              {item.metadata}
                            </span>
                          ) : null}
                        </span>
                      </Button>
                    ))}
                  </div>
                </Field>
                <div className="flex justify-end gap-2">
                  <Button
                    disabled={isSelecting}
                    onClick={() => void cancelPicker()}
                    type="button"
                    variant="brand-secondary"
                  >
                    Cancelar
                  </Button>
                  <Button disabled={!candidate || isSelecting} type="submit">
                    {isSelecting ? (
                      <Spinner
                        aria-label="Conectando cuenta seleccionada"
                        data-icon="inline-start"
                      />
                    ) : (
                      <CheckCircle2 data-icon="inline-start" />
                    )}
                    Conectar selección
                  </Button>
                </div>
              </form>
            ) : null}

            {step === "whatsapp" ? (
              <WhatsAppStatusConnection
                reconnectAccountId={whatsappReconnectAccountId ?? undefined}
                onConnected={async (account) => {
                  onConnected(account)
                  await onWhatsAppConnectionCompleted()
                  reset()
                  onOpenChange(false)
                }}
              />
            ) : null}

            {step === "connected" && capability ? (
              <Card variant="inset">
                <CardContent className="flex items-start gap-3 py-5">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-5 text-success"
                  />
                  <div className="grid gap-1">
                    <p className="font-medium">{capability.label} conectado</p>
                    <p className="text-sm text-muted-foreground">
                      La cuenta ya está disponible para publicar.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
