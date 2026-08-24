"use client"

import Link from "next/link"
import { CreditCard, LifeBuoy, LockKeyhole } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"

type PlanLockedModuleProps = {
  canManagePlan: boolean
  moduleLabel: string
  reason: "plan" | "workspace"
  translations: {
    description: string
    memberDescription: string
    planAction: string
    previewDescription: string
    title: string
    workspaceAction: string
    workspaceDescription: string
  }
}

export function PlanLockedModule({
  canManagePlan,
  moduleLabel,
  reason,
  translations,
}: PlanLockedModuleProps) {
  const titleId = "plan-locked-module-title"
  const isPlanLocked = reason === "plan"
  const ActionIcon = isPlanLocked ? CreditCard : LifeBuoy

  return (
    <section
      aria-labelledby={titleId}
      className="relative min-h-[calc(100svh-var(--dashboard-header-height)-3rem)] overflow-hidden rounded-xl"
    >
      <Card
        aria-hidden="true"
        className="min-h-[calc(100svh-var(--dashboard-header-height)-3rem)] opacity-40"
        variant="inset"
      >
        <CardHeader>
          <CardTitle>{moduleLabel}</CardTitle>
          <CardDescription>{translations.previewDescription}</CardDescription>
        </CardHeader>
        <CardContent className="min-h-96" />
      </Card>

      <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-6">
        <Empty className="min-h-72 max-w-xl border bg-background shadow-sm">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LockKeyhole aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle id={titleId}>{translations.title}</EmptyTitle>
            <EmptyDescription>
              {isPlanLocked
                ? canManagePlan
                  ? translations.description
                  : translations.memberDescription
                : translations.workspaceDescription}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href={isPlanLocked ? "/portal/plans" : "/portal/support"}>
                <ActionIcon data-icon="inline-start" />
                {isPlanLocked
                  ? translations.planAction
                  : translations.workspaceAction}
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    </section>
  )
}
