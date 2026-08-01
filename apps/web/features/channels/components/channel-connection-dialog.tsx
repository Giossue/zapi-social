"use client"

import { channelConnectionsApi } from "@workspace/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { toast } from "@workspace/ui/components/toast"
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Unplug,
} from "lucide-react"
import { useEffect, useState } from "react"
import type {
  ChannelCandidate,
  PortalChannelAccount,
  PortalChannelCapability,
} from "../types/channels"

type DialogStep = "capabilities" | "authorizing" | "picker" | "whatsapp" | "connected"
type WhatsAppState = "start" | "waiting" | "expired" | "connected"

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

function CapabilityCard({
  capability,
  onSelect,
}: {
  capability: PortalChannelCapability
  onSelect: (capability: PortalChannelCapability) => void
}) {
  const Icon = capability.icon
  const blocked = capability.availability !== "ready"
  const label = blocked
    ? capability.availability === "plan_locked"
      ? "No incluido en tu plan"
      : "Próximamente"
    : "Disponible"

  return (
    <Card variant="surface">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          {!blocked ? <Badge variant="success">{label}</Badge> : null}
        </div>
        <div className="space-y-1">
          <p className="font-semibold">{capability.label}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {blocked ? label : capability.description}
          </p>
        </div>
        <Button
          className="mt-auto w-full"
          disabled={blocked}
          onClick={() => onSelect(capability)}
          type="button"
          variant={blocked ? "surface" : "brand-secondary"}
        >
          {blocked ? <Unplug data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
          {blocked ? label : "Conectar"}
        </Button>
      </CardContent>
    </Card>
  )
}

function QrMock() {
  return (
    <div
      aria-label="Código QR sintético para Historias de WhatsApp"
      className="grid size-40 grid-cols-5 gap-1 rounded-lg border border-border bg-card p-3"
      role="img"
    >
      {Array.from({ length: 25 }, (_, index) => (
        <span
          className={index % 3 === 0 || index % 5 === 0 ? "bg-foreground" : "bg-muted"}
          key={index}
        />
      ))}
    </div>
  )
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
  account: Awaited<ReturnType<typeof channelConnectionsApi.select>>["account"],
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
    connectedAt: account.createdAt.slice(0, 10),
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
  onOpenChange,
}: {
  capabilities: readonly PortalChannelCapability[]
  open: boolean
  metaPickerSession: MetaPickerSession | null
  onConnected: (account: PortalChannelAccount) => void
  onMetaAuthorizationStart: (result: Awaited<ReturnType<typeof channelConnectionsApi.startMeta>>, capability: PortalChannelCapability) => void
  onMetaConnectionCompleted: () => Promise<void>
  onMetaConnectionCancelled: () => void
  onOpenChange: (open: boolean) => void
}) {
  const [capability, setCapability] = useState<PortalChannelCapability | null>(null)
  const [candidate, setCandidate] = useState<ChannelCandidate | null>(null)
  const [step, setStep] = useState<DialogStep>("capabilities")
  const [whatsAppState, setWhatsAppState] = useState<WhatsAppState>("start")
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)

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
    setWhatsAppState("start")
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
        const result = await channelConnectionsApi.startMeta({ capabilityKey: nextCapability.key })
        onMetaAuthorizationStart(result, nextCapability)
      } catch (error) {
        console.error("Meta authorization start failed", error)
        toast.error("No pudimos iniciar la autorización con Meta. Inténtalo de nuevo.")
        setStep("capabilities")
      } finally {
        setIsAuthorizing(false)
      }
      return
    }

    if (nextCapability.connectionKind === "qr") {
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
      handle: selected.label.startsWith("@") ? selected.label.slice(1) : undefined,
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
      const result = await channelConnectionsApi.select(metaPickerSession.connectionId, {
        candidateId: candidate.id,
      })
      onConnected(toPortalAccount(result.account))
      await onMetaConnectionCompleted()
      toast.success(`${metaPickerSession.capability.label} conectado.`)
    } catch (error) {
      console.error("Meta candidate selection failed", error)
      toast.error("No pudimos conectar la cuenta seleccionada. Inténtalo de nuevo.")
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
        toast.error("No pudimos cancelar la conexión con Meta. Inténtalo de nuevo.")
      } finally {
        setIsSelecting(false)
      }
      return
    }

    reset()
    onOpenChange(false)
  }

  const title = capability ? `Conectar ${capability.label}` : "Conectar un canal"
  const isMetaPicker = capability?.provider === "meta"
  const pickerCandidates = isMetaPicker ? metaPickerSession?.candidates ?? [] : capability?.candidates ?? []

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {capability?.provider === "meta"
              ? "Autoriza Meta para ver y conectar los recursos elegibles de tu cuenta."
              : "Los conectores disponibles fuera de Meta permanecen en modo de referencia."}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100dvh-10rem)]" scrollbarClassName="translate-x-6" type="always">
          <div className="grid gap-5 px-6 pt-5 pr-12 pb-6">
            {step === "capabilities" ? (
              <ScrollArea className="max-h-[calc(100dvh-18rem)] overflow-visible pr-3" scrollbarClassName="translate-x-8" type="always">
                <div aria-label="Tipos de canal" className="grid gap-3 pb-6 sm:grid-cols-2 xl:grid-cols-3">
                  {capabilities.map((item) => (
                    <CapabilityCard capability={item} key={item.key} onSelect={(item) => void selectCapability(item)} />
                  ))}
                </div>
              </ScrollArea>
            ) : null}

            {isAuthorizing ? (
              <Card variant="inset">
                <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
                  <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />
                  Preparando la autorización con Meta…
                </CardContent>
              </Card>
            ) : null}

            {step === "authorizing" && capability ? (
              <div className="grid gap-5">
                <Card variant="inset">
                  <CardContent className="flex items-start gap-3 py-5">
                    <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 text-primary" />
                    <div className="grid gap-1">
                      <p className="font-medium">Autorización simulada de {providerLabels[capability.provider]}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">En producción se abrirá el proveedor, se validará el retorno y se mostrarán solo los recursos elegibles.</p>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-end"><Button onClick={authorizeMock} type="button">Simular autorización aceptada</Button></div>
              </div>
            ) : null}

            {step === "picker" && capability ? (
              <div className="grid gap-4">
                <p className="text-sm text-muted-foreground">Elige un único recurso devuelto para esta conexión.</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {pickerCandidates.map((item) => (
                    <Button aria-pressed={candidate?.id === item.id} className="h-auto justify-start gap-3 px-4 py-3 text-left whitespace-normal" key={item.id} onClick={() => setCandidate(item)} type="button" variant={candidate?.id === item.id ? "brand-secondary" : "surface"}>
                      <CandidateAvatar candidate={item} />
                      <span className="grid min-w-0 gap-0.5"><span>{item.label}</span><span className="text-sm font-normal text-muted-foreground">{item.description}</span>{item.metadata ? <span className="text-xs font-normal text-muted-foreground">{item.metadata}</span> : null}</span>
                    </Button>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button disabled={isSelecting} onClick={() => void cancelPicker()} type="button" variant="brand-secondary">Cancelar</Button>
                  <Button disabled={!candidate || isSelecting} onClick={() => void (isMetaPicker ? selectMetaCandidate() : candidate && finishMockConnection(candidate))} type="button">
                    {isSelecting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
                    Conectar selección
                  </Button>
                </div>
              </div>
            ) : null}

            {step === "whatsapp" ? (
              <div className="grid gap-5">
                {whatsAppState === "start" ? <Card variant="inset"><CardContent className="flex items-start gap-3 py-5"><Smartphone aria-hidden="true" className="mt-0.5 size-5 text-primary" /><div className="grid gap-1"><p className="font-medium">Preparar vínculo por QR</p><p className="text-sm leading-relaxed text-muted-foreground">El conector real crea un dispositivo temporal y consulta su estado.</p></div></CardContent></Card> : null}
                {whatsAppState === "waiting" ? <Card variant="inset"><CardContent className="grid justify-items-center gap-4 py-5 text-center"><QrMock /><div><p className="flex items-center justify-center gap-2 font-medium"><QrCode aria-hidden="true" className="size-4 text-primary" />Escanea el QR desde WhatsApp</p><p className="mt-1 text-sm text-muted-foreground">Esperando confirmación del dispositivo.</p></div></CardContent></Card> : null}
                {whatsAppState === "expired" ? <Card variant="inset"><CardContent className="flex items-start gap-3 py-5"><CircleAlert aria-hidden="true" className="mt-0.5 size-5 text-warning" /><div className="grid gap-1"><p className="font-medium">El QR expiró</p><p className="text-sm text-muted-foreground">Genera uno nuevo para continuar.</p></div></CardContent></Card> : null}
                {whatsAppState === "connected" ? <Card variant="inset"><CardContent className="flex items-start gap-3 py-5"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 text-success" /><div className="grid gap-1"><p className="font-medium">Historias de WhatsApp conectadas</p><p className="text-sm text-muted-foreground">La sesión simulada quedó vinculada.</p></div></CardContent></Card> : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {whatsAppState === "start" ? <Button onClick={() => setWhatsAppState("waiting")} type="button">Generar QR</Button> : null}
                  {whatsAppState === "waiting" ? <><Button onClick={() => setWhatsAppState("expired")} type="button" variant="brand-secondary"><Unplug />Simular expiración</Button><Button onClick={() => { setWhatsAppState("connected"); finishMockConnection({ id: "whatsapp-device-01", label: "WhatsApp de Northstar", description: "Historias de WhatsApp" }) }} type="button"><ScanLine />Marcar como conectado</Button></> : null}
                  {whatsAppState === "expired" ? <Button onClick={() => setWhatsAppState("waiting")} type="button"><RefreshCw />Generar otro QR</Button> : null}
                </div>
              </div>
            ) : null}

            {step === "connected" && capability ? <Card variant="inset"><CardContent className="flex items-start gap-3 py-5"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 text-success" /><div className="grid gap-1"><p className="font-medium">{capability.label} conectado</p><p className="text-sm text-muted-foreground">La cuenta ya está disponible para publicar.</p></div></CardContent></Card> : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
