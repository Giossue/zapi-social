"use client"

import { Clock3, LockKeyhole, Plus } from "lucide-react"

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

const availabilityCopy: Record<
  ChannelAvailability,
  {
    action: string
    icon: typeof Plus
    label: string
    variant: "default" | "outline"
  }
> = {
  ready: {
    action: "Conectar",
    icon: Plus,
    label: "Disponible",
    variant: "default",
  },
  coming_soon: {
    action: "Próximamente",
    icon: Clock3,
    label: "Próximamente",
    variant: "outline",
  },
  plan_locked: {
    action: "No incluido",
    icon: LockKeyhole,
    label: "Plan requerido",
    variant: "outline",
  },
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
  const ActionIcon = availability.icon
  const isAvailable = capability.availability === "ready"

  return (
    <Card className="h-full">
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
          {capability.description}
        </p>
      </CardContent>
      <CardFooter className="mt-auto justify-between gap-3">
        <Badge variant={isAvailable ? "secondary" : "outline"}>
          {availability.label}
        </Badge>
        <Button
          disabled={!isAvailable}
          onClick={onSelect}
          size="sm"
          type="button"
          variant={availability.variant}
        >
          <ActionIcon data-icon="inline-start" />
          {availability.action}
        </Button>
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
    <div aria-label="Tipos de canal" className="grid gap-3 sm:grid-cols-2">
      {capabilities.map((capability) => (
        <ChannelCapabilityCard
          capability={capability}
          key={capability.key}
          onSelect={() => onSelect(capability)}
        />
      ))}
    </div>
  )
}
