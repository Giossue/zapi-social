"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Link2 } from "lucide-react"
import type { ChannelOAuthProviderKey } from "../types/channels"

type ConnectionOption = {
  capabilityKey: string
  description: string
  icon: typeof Link2
  label: string
}

const connectionOptions: Record<
  ChannelOAuthProviderKey,
  readonly ConnectionOption[]
> = {
  facebook: [
    {
      capabilityKey: "facebook-page",
      description: "Conecta una página que administras en Facebook.",
      icon: Link2,
      label: "Facebook Page",
    },
    {
      capabilityKey: "instagram-profile",
      description: "Conecta un perfil profesional de Instagram.",
      icon: Link2,
      label: "Instagram Profile",
    },
  ],
  linkedin: [
    {
      capabilityKey: "linkedin-profile",
      description: "Conecta tu perfil personal de LinkedIn.",
      icon: Link2,
      label: "LinkedIn Profile",
    },
    {
      capabilityKey: "linkedin-page",
      description: "Conecta una página de organización de LinkedIn.",
      icon: Link2,
      label: "LinkedIn Page",
    },
  ],
}

function connectUrl(
  providerKey: ChannelOAuthProviderKey,
  capabilityKey: string
) {
  const params = new URLSearchParams({ capabilityKey })
  return `/api/v1/portal/channels/${providerKey}/connect?${params.toString()}`
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
  const options = readyProviders.flatMap((providerKey) =>
    connectionOptions[providerKey].map((option) => ({
      ...option,
      providerKey,
    }))
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar canal</DialogTitle>
          <DialogDescription>
            Elige el tipo de destino que quieres autorizar. Continuarás en el
            proveedor para conceder acceso.
          </DialogDescription>
        </DialogHeader>
        <div aria-label="Tipos de canal disponibles" className="grid gap-3">
          {options.map(
            ({
              capabilityKey,
              description,
              icon: Icon,
              label,
              providerKey,
            }) => (
              <Button
                className="h-auto justify-start gap-3 px-4 py-3 text-left"
                key={`${providerKey}-${capabilityKey}`}
                onClick={() => {
                  window.location.assign(connectUrl(providerKey, capabilityKey))
                }}
                variant="brand-secondary"
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="grid gap-0.5">
                  <span>{label}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {description}
                  </span>
                </span>
              </Button>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
