"use client"

import { useTranslations } from "next-intl"

import { RouteErrorState } from "@/components/route-error-state"

export default function PortalError({ reset }: { reset: () => void }) {
  const t = useTranslations("routeStates")

  return (
    <RouteErrorState
      reset={reset}
      title={t("portal.title")}
      description={t("portal.description")}
    />
  )
}
