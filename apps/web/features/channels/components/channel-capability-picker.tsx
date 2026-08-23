"use client"

import { Plus } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { CardGrid } from "@workspace/ui/components/card-grid"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import type {
  ChannelAvailability,
  PortalChannelCapability,
} from "../types/channels"

const availabilityCopy: Record<ChannelAvailability, { label: string }> = {
  ready: { label: "Disponible" },
  coming_soon: { label: "Próximamente" },
  plan_locked: { label: "Plan requerido" },
}

function capabilityDescription(capability: PortalChannelCapability) {
  if (capability.availability === "ready") return capability.description
  if (capability.availability === "plan_locked") {
    return "Este canal no está incluido en tu plan actual."
  }
  return "Estamos preparando esta conexión."
}

function ChannelCapabilityCard({
  capability,
  onSelect,
}: {
  capability: PortalChannelCapability
  onSelect: () => void
}) {
  const Icon = capability.icon
  const availability = availabilityCopy[capability.availability]
  const isAvailable = capability.availability === "ready"

  return (
    <Card className="h-full" variant="surface">
      <CardHeader>
        {/* Stacked on phones so the name gets the full card width instead of
            sharing a narrow row with the icon. */}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon aria-hidden="true" className="size-4.5" />
          </div>
          <CardTitle className="min-w-0 text-pretty">
            {capability.label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm leading-snug text-muted-foreground">
          {capabilityDescription(capability)}
        </p>
      </CardContent>
      {/* An available channel is already signalled by its button, so only the
          ones you can't connect yet need to say why. */}
      <CardFooter className="mt-auto">
        {isAvailable ? (
          <Button className="w-full" onClick={onSelect} size="sm" type="button">
            <Plus data-icon="inline-start" />
            Conectar
          </Button>
        ) : (
          <Badge className="leading-none" variant="neutral">
            {availability.label}
          </Badge>
        )}
      </CardFooter>
    </Card>
  )
}

export function ChannelCapabilityGrid({
  capabilities,
  onSelect,
}: {
  capabilities: readonly PortalChannelCapability[]
  onSelect: (capability: PortalChannelCapability) => void
}) {
  return (
    <CardGrid
      aria-label="Tipos de canal"
      as="section"
      className="p-px pr-3 sm:pr-8"
      layout="md-3"
    >
      {capabilities.map((capability) => (
        <ChannelCapabilityCard
          capability={capability}
          key={capability.key}
          onSelect={() => onSelect(capability)}
        />
      ))}
    </CardGrid>
  )
}
