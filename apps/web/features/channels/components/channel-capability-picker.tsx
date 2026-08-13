"use client"

import { Plus } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon aria-hidden="true" className="size-4.5" />
          </div>
          <CardTitle className="min-w-0 truncate">{capability.label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm leading-snug text-muted-foreground">
          {capabilityDescription(capability)}
        </p>
      </CardContent>
      <CardFooter className="mt-auto justify-between gap-3">
        <Badge
          className="leading-none"
          variant={isAvailable ? "success" : "neutral"}
        >
          {availability.label}
        </Badge>
        {isAvailable ? (
          <Button onClick={onSelect} size="sm" type="button">
            <Plus data-icon="inline-start" />
            Conectar
          </Button>
        ) : null}
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
    <section
      aria-label="Tipos de canal"
      className="grid gap-3 p-px pr-8 sm:grid-cols-2"
    >
      {capabilities.map((capability) => (
        <ChannelCapabilityCard
          capability={capability}
          key={capability.key}
          onSelect={() => onSelect(capability)}
        />
      ))}
    </section>
  )
}
