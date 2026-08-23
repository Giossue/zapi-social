"use client"

import { useTranslations } from "next-intl"

import { DataTableToolbar as DataTableToolbarPrimitive } from "@workspace/ui/components/data-table-controls"

/**
 * Aporta el idioma al plegado móvil de filtros. El primitive no traduce: vive
 * en `packages/ui`, que no depende de `next-intl`.
 */
export function DataTableToolbar(
  props: Omit<
    React.ComponentProps<typeof DataTableToolbarPrimitive>,
    "filtersLabel"
  >
) {
  const t = useTranslations("common")

  return <DataTableToolbarPrimitive {...props} filtersLabel={t("filters")} />
}
