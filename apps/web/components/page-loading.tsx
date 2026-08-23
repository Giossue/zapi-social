"use client"

import { useTranslations } from "next-intl"

import { PageLoading as PageLoadingPrimitive } from "@workspace/ui/components/page-loading"

/**
 * Aporta el rótulo accesible al primitive de `packages/ui`, que no puede
 * depender de `next-intl`. Las rutas que ya pasan su propio `aria-label` lo
 * conservan; el resto recibe uno traducido en vez de un texto fijo.
 */
export function PageLoading(props: React.ComponentProps<"div">) {
  const t = useTranslations("common")

  return <PageLoadingPrimitive aria-label={t("loading")} {...props} />
}
