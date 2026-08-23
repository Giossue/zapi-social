"use client"

import { useTranslations } from "next-intl"

import { RouteErrorState } from "@/components/route-error-state"

export default function DashboardError({ reset }: { reset: () => void }) {
  const t = useTranslations("routeStates")

  return (
    <RouteErrorState
      description={t("dashboard.description")}
      reset={reset}
      title={t("dashboard.title")}
    />
  )
}
