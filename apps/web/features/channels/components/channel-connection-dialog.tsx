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
import {
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Unplug,
} from "lucide-react"
import { useState } from "react"
import {
  channelConnectionCapabilities,
  directConnectionResources,
  mockWhatsAppDevices,
} from "../fixtures/channel-connection"
import type {
  ChannelConnectionCapability,
  ConnectionResource,
} from "../types/channel-connection"
import type { ChannelOAuthProviderKey } from "../types/channels"

type ConnectionStep =
  "capability" | "oauth" | "picker" | "review" | "connected" | "whatsapp"
type WhatsAppState = "idle" | "waiting" | "connected" | "expired"

const providerLabels = {
  meta: "Meta",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
} as const

function StepBackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      className="w-fit"
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <ChevronLeft aria-hidden="true" />
      Volver
    </Button>
  )
}

function CapabilityOption({
  capability,
  onSelect,
}: {
  capability: ChannelConnectionCapability
  onSelect: (capability: ChannelConnectionCapability) => void
}) {
  const Icon = capability.icon

  return (
    <Button
      className="h-auto w-full items-start justify-start gap-3 px-4 py-3 text-left whitespace-normal"
      onClick={() => onSelect(capability)}
      type="button"
      variant="surface"
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span>{capability.label}</span>
          <Badge variant="neutral">{providerLabels[capability.provider]}</Badge>
        </span>
        <span className="text-sm leading-relaxed font-normal text-muted-foreground">
          {capability.description}
        </span>
      </span>
    </Button>
  )
}

function OAuthState({
  capability,
  onAuthorized,
}: {
  capability: ChannelConnectionCapability
  onAuthorized: () => void
}) {
  const usesPkce = capability.flow === "pkce-direct"

  return (
    <div className="grid gap-5">
      <Card variant="inset">
        <CardContent className="grid gap-4 py-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {usesPkce ? (
                <KeyRound aria-hidden="true" className="size-5" />
              ) : (
                <ShieldCheck aria-hidden="true" className="size-5" />
              )}
            </span>
            <div className="grid gap-1">
              <p className="font-medium">
                Autorización simulada de {providerLabels[capability.provider]}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                En producción se abrirá la autorización del proveedor y se
                validará el estado al volver.
              </p>
            </div>
          </div>
          <div className="grid gap-2 border-t pt-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Capability</span>
              <span className="font-medium">{capability.label}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">OAuth state</span>
              <Badge variant="neutral">mock session</Badge>
            </div>
            {usesPkce ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">PKCE</span>
                <span className="font-medium">
                  challenge local · verifier no expuesto
                </span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onAuthorized} type="button">
          Simular autorización aceptada
        </Button>
      </div>
    </div>
  )
}

function ResourcePicker({
  capability,
  selectedResourceId,
  onSelect,
  onContinue,
}: {
  capability: ChannelConnectionCapability
  selectedResourceId: string | null
  onSelect: (resource: ConnectionResource) => void
  onContinue: () => void
}) {
  const resources = capability.resources ?? []

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        Recursos sintéticos devueltos por {providerLabels[capability.provider]}.
        Elige el destino que quieres administrar.
      </p>
      <ScrollArea className="max-h-72 pr-3">
        <div className="grid gap-2">
          {resources.map((resource) => {
            const selected = resource.id === selectedResourceId
            return (
              <Button
                aria-pressed={selected}
                className="h-auto w-full justify-start px-4 py-3 text-left whitespace-normal"
                key={resource.id}
                onClick={() => onSelect(resource)}
                type="button"
                variant={selected ? "brand-secondary" : "surface"}
              >
                <span className="grid gap-0.5">
                  <span>{resource.label}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {resource.description}
                  </span>
                  {resource.metadata ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      {resource.metadata}
                    </span>
                  ) : null}
                </span>
              </Button>
            )
          })}
        </div>
      </ScrollArea>
      <div className="flex justify-end">
        <Button
          disabled={!selectedResourceId}
          onClick={onContinue}
          type="button"
        >
          Continuar con el destino
        </Button>
      </div>
    </div>
  )
}

function CreatorInfo({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="grid gap-5">
      <Card variant="inset">
        <CardContent className="grid gap-4 py-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div className="grid gap-1">
              <p className="font-medium">Información de creator</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                En Laravel, TikTok resuelve el perfil autorizado y permite
                consultar información de creator para los perfiles conectados.
              </p>
            </div>
          </div>
          <div className="grid gap-2 border-t pt-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Perfil mock</span>
              <span className="font-medium">@anatorres.creates</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Estado de creator</span>
              <Badge variant="success">Disponible</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={onContinue} type="button">
          Revisar conexión
        </Button>
      </div>
    </div>
  )
}

function ConnectionReview({
  capability,
  resource,
  onConfirm,
}: {
  capability: ChannelConnectionCapability
  resource: ConnectionResource
  onConfirm: () => void
}) {
  return (
    <div className="grid gap-5">
      <Card variant="inset">
        <CardContent className="grid gap-4 py-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <CheckCircle2 aria-hidden="true" className="size-5" />
            </span>
            <div className="grid gap-1">
              <p className="font-medium">Listo para confirmar</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Esta acción sólo actualiza el estado local de la Fase A; no crea
                un canal ni guarda tokens.
              </p>
            </div>
          </div>
          <div className="grid gap-2 border-t pt-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Canal</span>
              <span className="font-medium">{capability.label}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Destino</span>
              <span className="font-medium">{resource.label}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={onConfirm} type="button">
          Confirmar conexión mock
        </Button>
      </div>
    </div>
  )
}

function WhatsAppConnection({
  state,
  deviceId,
  onStart,
  onPoll,
  onExpire,
  onRetry,
  onReconnect,
}: {
  state: WhatsAppState
  deviceId: string | null
  onStart: () => void
  onPoll: () => void
  onExpire: () => void
  onRetry: () => void
  onReconnect: () => void
}) {
  if (state === "idle") {
    return (
      <div className="grid gap-5">
        <Card variant="inset">
          <CardContent className="flex items-start gap-3 py-5">
            <Smartphone
              aria-hidden="true"
              className="mt-0.5 size-5 text-primary"
            />
            <div className="grid gap-1">
              <p className="font-medium">Crear dispositivo temporal</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                El flujo real crea un device, solicita un QR y consulta su
                estado hasta completar el vínculo.
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button onClick={onStart} type="button">
            Crear device y generar QR mock
          </Button>
        </div>
      </div>
    )
  }

  if (state === "connected") {
    return (
      <div className="grid gap-5">
        <Card variant="inset">
          <CardContent className="flex items-start gap-3 py-5">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 text-success"
            />
            <div className="grid gap-1">
              <p className="font-medium">WhatsApp Status conectado</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                El polling mock confirmó la sesión del device{" "}
                <span className="font-medium text-foreground">{deviceId}</span>.
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button onClick={onReconnect} type="button" variant="brand-secondary">
            <RefreshCw aria-hidden="true" />
            Reconectar dispositivo
          </Button>
        </div>
      </div>
    )
  }

  if (state === "expired") {
    return (
      <div className="grid gap-5">
        <Card variant="inset">
          <CardContent className="flex items-start gap-3 py-5">
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 size-5 text-warning"
            />
            <div className="grid gap-1">
              <p className="font-medium">El QR mock expiró</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Genera un QR nuevo para continuar. El device anterior no se usa
                para esta simulación.
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button onClick={onRetry} type="button">
            <RefreshCw aria-hidden="true" />
            Reintentar QR
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      <Card variant="inset">
        <CardContent className="grid justify-items-center gap-4 py-5 text-center">
          <div
            className="grid size-40 grid-cols-5 gap-1 rounded-lg border bg-card p-3"
            role="img"
            aria-label="Código QR sintético para WhatsApp"
          >
            {Array.from({ length: 25 }, (_, index) => (
              <span
                className={
                  index % 3 === 0 || index % 5 === 0
                    ? "bg-foreground"
                    : "bg-muted"
                }
                key={index}
              />
            ))}
          </div>
          <div className="grid gap-1">
            <p className="flex items-center justify-center gap-2 font-medium">
              <QrCode aria-hidden="true" className="size-4 text-primary" />
              Escanea el QR desde dispositivos vinculados
            </p>
            <p className="text-sm text-muted-foreground">
              Device mock: {deviceId}
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onExpire} type="button" variant="ghost">
          <Unplug aria-hidden="true" />
          Simular expiración
        </Button>
        <Button onClick={onPoll} type="button" variant="brand-secondary">
          <LoaderCircle aria-hidden="true" className="animate-spin" />
          Simular polling
        </Button>
        <Button onClick={onPoll} type="button">
          <ScanLine aria-hidden="true" />
          Marcar como conectado
        </Button>
      </div>
    </div>
  )
}

export function ChannelConnectionDialog({
  open,
  onOpenChange,
  readyProviders,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  readyProviders: readonly ChannelOAuthProviderKey[]
}) {
  const [capability, setCapability] =
    useState<ChannelConnectionCapability | null>(null)
  const [selectedResource, setSelectedResource] =
    useState<ConnectionResource | null>(null)
  const [step, setStep] = useState<ConnectionStep>("capability")
  const [whatsAppState, setWhatsAppState] = useState<WhatsAppState>("idle")
  const [whatsAppDeviceId, setWhatsAppDeviceId] = useState<string | null>(null)

  const reset = () => {
    setCapability(null)
    setSelectedResource(null)
    setStep("capability")
    setWhatsAppState("idle")
    setWhatsAppDeviceId(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  const selectCapability = (nextCapability: ChannelConnectionCapability) => {
    setCapability(nextCapability)
    setSelectedResource(null)
    if (nextCapability.flow === "qr") {
      setStep("whatsapp")
      setWhatsAppState("idle")
      return
    }
    setStep("oauth")
  }

  const handleAuthorized = () => {
    if (!capability) return
    if (capability.flow === "oauth-picker") {
      setStep("picker")
      return
    }
    if (capability.flow === "creator-info") {
      setStep("picker")
      return
    }
    setSelectedResource(directConnectionResources[capability.key] ?? null)
    setStep("review")
  }

  const handleBack = () => {
    if (step === "capability") return
    if (step === "oauth" || step === "whatsapp") {
      reset()
      return
    }
    if (step === "picker") {
      setStep("oauth")
      return
    }
    if (step === "review") {
      setStep(capability?.flow === "oauth-picker" ? "picker" : "oauth")
      return
    }
    reset()
  }

  const currentResource =
    selectedResource ??
    (capability ? directConnectionResources[capability.key] : null)
  const configuredProviderCount = readyProviders.length
  const title = capability ? `Conectar ${capability.label}` : "Conectar canal"
  const description = capability
    ? "Flujo local de Fase A basado en el módulo Laravel. No se abrirá ningún proveedor ni se guardará información."
    : "Elige una capability. Esta vista usa datos sintéticos y modela el flujo de conexión sin llamadas API."

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{title}</DialogTitle>
            <Badge variant="neutral">Fase A mock</Badge>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 p-6">
          {step !== "capability" && step !== "connected" ? (
            <StepBackButton onClick={handleBack} />
          ) : null}

          {step === "capability" ? (
            <>
              <p className="text-xs text-muted-foreground">
                Dashboard actual: {configuredProviderCount} integración
                {configuredProviderCount === 1 ? "" : "es"} lista
                {configuredProviderCount === 1 ? "" : "s"}. Las capabilities
                restantes se presentan para validar el diseño mock.
              </p>
              <ScrollArea className="max-h-[calc(100dvh-17rem)] pr-3">
                <div
                  aria-label="Tipos de canal disponibles"
                  className="grid gap-2"
                >
                  {channelConnectionCapabilities.map((option) => (
                    <CapabilityOption
                      capability={option}
                      key={option.key}
                      onSelect={selectCapability}
                    />
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : null}

          {step === "oauth" && capability ? (
            <OAuthState
              capability={capability}
              onAuthorized={handleAuthorized}
            />
          ) : null}

          {step === "picker" && capability?.flow === "oauth-picker" ? (
            <ResourcePicker
              capability={capability}
              onContinue={() => setStep("review")}
              onSelect={setSelectedResource}
              selectedResourceId={selectedResource?.id ?? null}
            />
          ) : null}

          {step === "picker" && capability?.flow === "creator-info" ? (
            <CreatorInfo
              onContinue={() => {
                setSelectedResource(
                  directConnectionResources.tiktok_profile ?? null
                )
                setStep("review")
              }}
            />
          ) : null}

          {step === "review" && capability && currentResource ? (
            <ConnectionReview
              capability={capability}
              onConfirm={() => setStep("connected")}
              resource={currentResource}
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
                  <p className="font-medium">
                    {capability.label} conectado en el mock
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    La UI está lista para sustituir este estado local por el
                    contrato REST en una fase posterior.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === "whatsapp" ? (
            <WhatsAppConnection
              deviceId={whatsAppDeviceId}
              onExpire={() => setWhatsAppState("expired")}
              onPoll={() => setWhatsAppState("connected")}
              onReconnect={() => {
                setWhatsAppDeviceId(mockWhatsAppDevices.reconnect)
                setWhatsAppState("waiting")
              }}
              onRetry={() => {
                setWhatsAppDeviceId(mockWhatsAppDevices.retry)
                setWhatsAppState("waiting")
              }}
              onStart={() => {
                setWhatsAppDeviceId(mockWhatsAppDevices.initial)
                setWhatsAppState("waiting")
              }}
              state={whatsAppState}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
