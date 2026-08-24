"use client"

import { channelConnectionsApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  Sheet,
  SheetActions,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { CheckCircle2 } from "lucide-react"
import { type FormEvent, useState } from "react"
import { useTranslations } from "next-intl"

import { useChannelLabels } from "@/lib/channel-labels"
import type {
  ChannelCandidate,
  PortalChannelAccount,
  PortalChannelCapability,
} from "../types/channels"
import { ChannelCapabilityGrid } from "./channel-capability-picker"
import { WhatsAppStatusConnection } from "./whatsapp-status-connection"

type DialogStep = "capabilities" | "picker" | "whatsapp"

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
  const t = useTranslations("channelConnection")

  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-accent-foreground">
      <span aria-hidden="true">{candidateInitials(candidate.label)}</span>
      {candidate.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- el avatar lo sirve el proveedor con un dominio que no está en `remotePatterns`.
        <img
          alt={t("avatarAlt", { name: candidate.label })}
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
  const t = useTranslations("channelConnection")
  const labels = useChannelLabels()
  const [capability, setCapability] = useState<PortalChannelCapability | null>(
    null
  )
  const [candidate, setCandidate] = useState<ChannelCandidate | null>(null)
  const [step, setStep] = useState<DialogStep>("capabilities")
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)

  const entrada = !open
    ? null
    : metaPickerSession
      ? `picker:${metaPickerSession.capability.key}`
      : whatsappReconnectAccountId
        ? `whatsapp:${whatsappReconnectAccountId}`
        : null
  const [ultimaEntrada, setUltimaEntrada] = useState(entrada)

  if (entrada !== ultimaEntrada) {
    setUltimaEntrada(entrada)
    if (metaPickerSession && open) {
      setCapability(metaPickerSession.capability)
      setCandidate(null)
      setStep("picker")
    } else if (whatsappReconnectAccountId && open) {
      const whatsappCapability = capabilities.find(
        (item) => item.key === "whatsapp_status"
      )
      if (whatsappCapability) {
        setCapability(whatsappCapability)
        setCandidate(null)
        setStep("whatsapp")
      }
    }
  }

  function reset() {
    setCapability(null)
    setCandidate(null)
    setStep("capabilities")
    setIsAuthorizing(false)
    setIsSelecting(false)
  }

  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) reset()
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  async function selectCapability(nextCapability: PortalChannelCapability) {
    setCapability(nextCapability)
    setCandidate(null)

    if (nextCapability.connectionKind === "qr_device") {
      setStep("whatsapp")
      return
    }

    setIsAuthorizing(true)
    try {
      const result = await channelConnectionsApi.startMeta({
        capabilityKey: nextCapability.key,
      })
      onMetaAuthorizationStart(result, nextCapability)
    } catch (error) {
      console.error("Channel authorization start failed", error)
      toast.error(t("authStartFailed"))
      setStep("capabilities")
    } finally {
      setIsAuthorizing(false)
    }
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
      toast.success(
        t("connected", {
          channel: labels.capability(metaPickerSession.capability.key),
        })
      )
    } catch (error) {
      console.error("Meta candidate selection failed", error)
      toast.error(t("connectFailed"))
    } finally {
      setIsSelecting(false)
    }
  }

  async function cancelPicker() {
    if (!metaPickerSession) {
      reset()
      onOpenChange(false)
      return
    }
    setIsSelecting(true)
    try {
      await channelConnectionsApi.cancel(metaPickerSession.connectionId)
      onMetaConnectionCancelled()
      reset()
      onOpenChange(false)
      toast.success(t("cancelled"))
    } catch (error) {
      console.error("Meta connection cancellation failed", error)
      toast.error(t("cancelFailed"))
    } finally {
      setIsSelecting(false)
    }
  }

  function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!candidate || !capability) {
      toast.error(t("pickAccount"))
      return
    }
    if (!metaPickerSession) {
      toast.error(t("sessionLost"))
      return
    }
    void selectMetaCandidate()
  }

  const title = capability
    ? t("connectChannel", { channel: labels.capability(capability.key) })
    : t("connectAnyChannel")
  const pickerCandidates = metaPickerSession?.candidates ?? []

  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-none data-[side=right]:sm:w-full data-[side=right]:sm:border-l-0"
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {capability?.provider === "meta"
              ? t("metaDescription")
              : t("otherProviderDescription")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <div className="mx-auto grid w-full max-w-5xl gap-4">
            {step === "capabilities" ? (
              <ChannelCapabilityGrid
                capabilities={capabilities}
                onSelect={(capability) => void selectCapability(capability)}
              />
            ) : null}

            {isAuthorizing ? (
              <Card variant="inset">
                <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
                  <Spinner aria-label={t("preparingAria")} />
                  {t("preparing")}
                </CardContent>
              </Card>
            ) : null}

            {step === "picker" && capability ? (
              <form
                aria-busy={isSelecting}
                className="grid gap-4"
                id="channel-candidate-form"
                noValidate
                onSubmit={submitCandidate}
              >
                <Field>
                  <FieldLabel id="channel-candidate-label">
                    {t("availableAccount")}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FieldLabel>
                  <CardGrid
                    aria-labelledby="channel-candidate-label"
                    aria-required="true"
                    layout="xl-3"
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
                  </CardGrid>
                </Field>
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
          </div>
        </div>
        {step === "picker" && capability ? (
          <SheetActions>
            <Button
              disabled={isSelecting}
              onClick={() => void cancelPicker()}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={!candidate || isSelecting}
              form="channel-candidate-form"
              type="submit"
            >
              {isSelecting ? (
                <Spinner
                  aria-label={t("connecting")}
                  data-icon="inline-start"
                />
              ) : (
                <CheckCircle2 data-icon="inline-start" />
              )}
              {t("connectSelection")}
            </Button>
          </SheetActions>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
