"use client"

import { PageLoading } from "@/components/page-loading"
import { useTranslations } from "next-intl"

export default function AdminLoading() {
  const t = useTranslations("routeStates")

  return <PageLoading aria-label={t("admin.loading")} />
}
