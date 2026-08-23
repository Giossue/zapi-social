"use client"

import { useTranslations } from "next-intl"

import { RouteErrorState } from "@/components/route-error-state"

export default function AdminError({ reset }: { reset: () => void }) {
  const t = useTranslations("routeStates")

  return (
    <RouteErrorState
      reset={reset}
      title={t("admin.title")}
      description={t("admin.description")}
    />
  )
}
