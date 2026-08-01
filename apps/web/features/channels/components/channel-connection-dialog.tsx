"use client"

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
  ChevronLeft,
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
import { useState } from "react"
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

export function ChannelConnectionDialog({
  capabilities,
  open,
  onConnected,
  onOpenChange,
}: {
  capabilities: readonly PortalChannelCapability[]
  open: boolean
  onConnected: (account: PortalChannelAccount) => void
  onOpenChange: (open: boolean) => void
}) {
  const [capability, setCapability] = useState<PortalChannelCapability | null>(null)
  const [candidate, setCandidate] = useState<ChannelCandidate | null>(null)
  const [step, setStep] = useState<DialogStep>("capabilities")
  const [whatsAppState, setWhatsAppState] = useState<WhatsAppState>("start")

  function reset() {
    setCapability(null)
    setCandidate(null)
    setStep("capabilities")
    setWhatsAppState("start")
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  function selectCapability(nextCapability: PortalChannelCapability) {
    setCapability(nextCapability)
    setCandidate(null)
    if (nextCapability.connectionKind === "qr") {
      setStep("whatsapp")
      return
    }
    setStep("authorizing")
  }

  function finishConnection(selected: ChannelCandidate) {
    if (!capability) return
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

  function authorize() {
    if (!capability) return
    if (capability.connectionKind === "picker") {
      setStep("picker")
      return
    }
    finishConnection({
      id: `${capability.key}-direct`,
      label: `Cuenta de ${providerLabels[capability.provider]}`,
      description: capability.label,
    })
  }

  function back() {
    if (step === "capabilities") return
    if (step === "picker") {
      setStep("authorizing")
      return
    }
    reset()
  }

  const title = capability ? `Conectar ${capability.label}` : "Conectar un canal"

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Flujo simulado del Portal. No abre proveedores ni guarda credenciales.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea
          className="max-h-[calc(100dvh-10rem)]"
          scrollbarClassName="translate-x-6"
          type="always"
        >
          <div className="grid gap-5 px-6 pt-5 pr-12 pb-6">
        {step !== "capabilities" && step !== "connected" ? (
          <Button className="w-fit" onClick={back} size="sm" type="button" variant="brand-secondary">
            <ChevronLeft aria-hidden="true" />
            Volver
          </Button>
        ) : null}

        {step === "capabilities" ? (
          <ScrollArea
            className="max-h-[calc(100dvh-18rem)] overflow-visible pr-3"
            scrollbarClassName="translate-x-8"
            type="always"
          >
            <div aria-label="Tipos de canal" className="grid gap-3 pb-6 sm:grid-cols-2 xl:grid-cols-3">
              {capabilities.map((item) => (
                <CapabilityCard capability={item} key={item.key} onSelect={selectCapability} />
              ))}
            </div>
          </ScrollArea>
        ) : null}

        {step === "authorizing" && capability ? (
          <div className="grid gap-5">
            <Card variant="inset">
              <CardContent className="flex items-start gap-3 py-5">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 text-primary" />
                <div className="grid gap-1">
                  <p className="font-medium">Autorización simulada de {providerLabels[capability.provider]}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    En producción se abrirá el proveedor, se validará el retorno y se mostrarán solo los recursos elegibles.
                  </p>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button onClick={authorize} type="button">Simular autorización aceptada</Button>
            </div>
          </div>
        ) : null}

        {step === "picker" && capability ? (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">Elige un único recurso devuelto para esta conexión.</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(capability.candidates ?? []).map((item) => (
                <Button
                  aria-pressed={candidate?.id === item.id}
                  className="h-auto justify-start px-4 py-3 text-left whitespace-normal"
                  key={item.id}
                  onClick={() => setCandidate(item)}
                  type="button"
                  variant={candidate?.id === item.id ? "brand-secondary" : "surface"}
                >
                  <span className="grid gap-0.5">
                    <span>{item.label}</span>
                    <span className="text-sm font-normal text-muted-foreground">{item.description}</span>
                    {item.metadata ? <span className="text-xs font-normal text-muted-foreground">{item.metadata}</span> : null}
                  </span>
                </Button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button disabled={!candidate} onClick={() => candidate && finishConnection(candidate)} type="button">
                Conectar selección
              </Button>
            </div>
          </div>
        ) : null}

        {step === "whatsapp" ? (
          <div className="grid gap-5">
            {whatsAppState === "start" ? (
              <Card variant="inset">
                <CardContent className="flex items-start gap-3 py-5">
                  <Smartphone aria-hidden="true" className="mt-0.5 size-5 text-primary" />
                  <div className="grid gap-1">
                    <p className="font-medium">Preparar vínculo por QR</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">El conector real crea un dispositivo temporal y consulta su estado.</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {whatsAppState === "waiting" ? (
              <Card variant="inset">
                <CardContent className="grid justify-items-center gap-4 py-5 text-center">
                  <QrMock />
                  <div>
                    <p className="flex items-center justify-center gap-2 font-medium"><QrCode aria-hidden="true" className="size-4 text-primary" />Escanea el QR desde WhatsApp</p>
                    <p className="mt-1 text-sm text-muted-foreground">Esperando confirmación del dispositivo.</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {whatsAppState === "expired" ? (
              <Card variant="inset">
                <CardContent className="flex items-start gap-3 py-5">
                  <CircleAlert aria-hidden="true" className="mt-0.5 size-5 text-warning" />
                  <div className="grid gap-1"><p className="font-medium">El QR expiró</p><p className="text-sm text-muted-foreground">Genera uno nuevo para continuar.</p></div>
                </CardContent>
              </Card>
            ) : null}
            {whatsAppState === "connected" ? (
              <Card variant="inset">
                <CardContent className="flex items-start gap-3 py-5">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 text-success" />
                  <div className="grid gap-1"><p className="font-medium">Historias de WhatsApp conectadas</p><p className="text-sm text-muted-foreground">La sesión simulada quedó vinculada.</p></div>
                </CardContent>
              </Card>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {whatsAppState === "start" ? <Button onClick={() => setWhatsAppState("waiting")} type="button">Generar QR</Button> : null}
              {whatsAppState === "waiting" ? <><Button onClick={() => setWhatsAppState("expired")} type="button" variant="brand-secondary"><Unplug />Simular expiración</Button><Button onClick={() => { setWhatsAppState("connected"); finishConnection({ id: "whatsapp-device-01", label: "WhatsApp de Northstar", description: "Historias de WhatsApp" }) }} type="button"><ScanLine />Marcar como conectado</Button></> : null}
              {whatsAppState === "expired" ? <Button onClick={() => setWhatsAppState("waiting")} type="button"><RefreshCw />Generar otro QR</Button> : null}
            </div>
          </div>
        ) : null}

        {step === "connected" && capability ? (
          <Card variant="inset">
            <CardContent className="flex items-start gap-3 py-5">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 text-success" />
              <div className="grid gap-1"><p className="font-medium">{capability.label} conectado</p><p className="text-sm text-muted-foreground">La cuenta aparece solo en este mock local.</p></div>
            </CardContent>
          </Card>
        ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
